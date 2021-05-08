import waitPort from "wait-port";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { promisify } from "util";
import { join, resolve, sep } from "path";
import { mkdir as mkdirCallback, writeFile as writeFileCallback } from "fs";

import {
  AnyEventCallback,
  OTAPI,
  TmpRunfilePair,
  createTmpRunfilePair,
} from "./otapi";
import { CallbackQueue, Deferred } from "./util";
import { args } from "./cli";
import { buildChunkLogger } from "./util";
import { Infrastructure, infrastructureFactory } from "./infrastructure";
import { TrainCounter } from "./train-counter";
import { testConnection } from "./connection-test";
import {
  CurryLog,
  createCurryLogStreamFileConsumer,
  curryLog,
  curryLogCleanConsoleConsumer,
} from "./curry-log";

import {
  DecisionModule,
  OvertakingParams,
  decisionModuleFactories,
  overtaking,
} from "./overtaking";
import { retry } from "./otapi/util";
import { pathExists, remove } from "fs-extra";

process.on("unhandledRejection", (error: any): void => {
  debugger;
  console.error("==== unhandledRejection ====", "\n", error.stack, "\n");
});

const mkdir = promisify(mkdirCallback);
const writeFile = promisify(writeFileCallback);

const cooldownMs = 2000;

interface OvertakingModule {
  confString: string;
  fsConfString: string;
  module: DecisionModule;
}

async function startUnless(otapi: OTAPI): Promise<void> {
  // Continue only if:
  if (
    // The user doesn't want to pause before each run.
    args["pause-before-each-run"] === false
  ) {
    await otapi.startSimulation();
  } else {
    // Otherwise wait for the user to click the resume button in
    // OpenTrack on their own.
    log.info("Resume in OpenTrack to continue...");
  }
}

async function continueUnless(
  otapi: OTAPI,
  trainCounter: TrainCounter
): Promise<void> {
  if (trainCounter.size > 0) {
    // This simulation run failed.
    log.warn(`${trainCounter.size} stuck trains.`);
  }

  // Continue only if:
  if (
    // The user doesn't want to pause after each run.
    args["pause-after-each-run"] === false &&
    // No trains are stuck in the model.
    (trainCounter.size === 0 ||
      // The user doesn't want to pause and inspect the situation.
      args["pause-with-stuck-trains"] === false)
  ) {
    await otapi.startSimulation();
  } else {
    // Otherwise wait for the user to click the resume button in
    // OpenTrack on their own.
    log.info("Resume in OpenTrack to continue...");
  }
}

function spawnAndLog(
  log: CurryLog,
  binaryPath: string,
  args: readonly string[],
  logPath: string,
  onLogLine: (logLine: string) => void = (): void => {}
): { child: ChildProcessWithoutNullStreams; returnCode: Promise<number> } {
  const child = spawn(binaryPath, args);

  const returnCode = new Promise<number>((resolve, reject): void => {
    let stdout = "";
    let stderr = "";

    const logStdout = buildChunkLogger(log, "info", onLogLine);
    const logStderr = buildChunkLogger(log, "warn", onLogLine);

    child.stdout.on("data", (chunk): void => {
      const string: string = chunk.toString();

      stdout += string;
      logStdout(string);
    });
    child.stderr.on("data", (chunk): void => {
      const string: string = chunk.toString();

      stderr += string;
      logStderr(string);
    });

    child.on("close", (code): void => {
      writeFile(
        logPath,
        [
          `OpenTrack exited with exit code ${code}.`,
          `STDOUT:\n${stdout}`,
          `STDERR:\n${stderr}`,
        ].join("\n\n")
      )
        .then(resolve.bind(null, code))
        .catch(reject);
    });
  });

  return { child, returnCode };
}

async function startOpenTrackAndOTAPI(
  log: CurryLog,
  {
    runNumber,
    runSuffix,
    runfiles,
  }: {
    runNumber?: number;
    runSuffix: string;
    runfiles: TmpRunfilePair;
  }
): Promise<{
  command: ReturnType<typeof spawnAndLog>;
  otapi: OTAPI;
  simulationRunning: Promise<void>;
  trainCounter: TrainCounter;
}> {
  const otArgs = Object.freeze([
    "-otd",
    (runNumber ?? 1) === 1 ? "-scriptinit" : "-script",
    `-runfile=${runfiles.tmp.path}`,
  ]);
  log.info("OpenTrack commandline:", [args["ot-binary"], ...otArgs]);

  for (let attempt = 1; ; ++attempt) {
    const cleanupCallbacks: (() => Promise<void>)[] = [];

    try {
      const { otapi, simulationRunning, trainCounter } = await prepareForRun(
        log("preparations"),
        runfiles,
        runSuffix,
        runNumber
      );
      cleanupCallbacks.push(otapi.kill.bind(otapi));

      const simStarted = otapi.once("simStarted");
      const simPaused = otapi.once("simPaused");

      log.info(
        attempt === 1
          ? "Starting OpenTrack..."
          : `Starting OpenTrack (attempt ${attempt})...`
      );
      const command = spawnAndLog(
        log("OT"),
        args["ot-binary"],
        otArgs,
        args["ot-log"],
        (line): void => {
          if (
            / OpenTrack\[\d+\] OTServerGenerator startPSMServer Socket NO success$/.test(
              line
            ) ||
            / OpenTrack\[\d+\] OTPSMController Can't connect to port \d+ on host .+$/.test(
              line
            )
          ) {
            // noop
          }
        }
      );

      const killOpenTrack = async (): Promise<void> => {
        log.info("Waiting for OpenTrack process to terminate...");
        command.child.kill("SIGTERM");
        await command.returnCode;
        log.info("OpenTrack terminated.");
      };

      cleanupCallbacks.push(killOpenTrack);
      otapi.onFailure(
        async (): Promise<void> => {
          log.error(
            new Error("Communication failure"),
            "Communication failed, killing current run."
          );
          await killOpenTrack();
          await otapi.kill();
        }
      );

      await Promise.all([
        simStarted,
        simPaused,
        waitPort({
          port: otapi.config.portOT,
          output: "silent",
          timeout: 120 * 1000,
        }),
      ]);
      log.info("OpenTrack is ready for simulation.");
      await otapi.openSimulationPanel({ mode: "Simulation" });
      log.info("OpenTrack responds to requests.");

      return { command, otapi, simulationRunning, trainCounter };
    } catch (error) {
      log.error(error, "Startup failed.");

      for (const callback of cleanupCallbacks.splice(0).reverse()) {
        try {
          await callback();
        } catch (error) {
          log.error(
            error,
            "An error occured during failed OpenTrack startup cleanup."
          );
        }
      }

      await new Promise(
        (resolve): void => void setTimeout(resolve, cooldownMs)
      );
      log.info("Trying again...");
      log.info();
    }
  }
}

async function changeOutputPath(
  runfiles: TmpRunfilePair,
  variant: string
): Promise<void> {
  const parts = (await runfiles.orig.readValue("OutputPath")).split(sep);

  // Remove trailing separator.
  while (parts[parts.length - 1] === "") {
    parts.pop();
  }

  // Add current run number.
  parts.push(variant);

  // Create the output directory if it doesn't exist yet.
  for (let i = 2; i <= parts.length; ++i) {
    try {
      await mkdir(join(...parts.slice(0, i)));
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  // Save the path into the runfile.
  const path = join(...parts);
  await runfiles.tmp.writeValue("OutputPath", path);
}

async function prepareForRun(
  log: CurryLog,
  runfiles: TmpRunfilePair,
  runSuffix?: string,
  runNumber?: number
): Promise<{
  otapi: OTAPI;
  simulationRunning: Promise<void>;
  trainCounter: TrainCounter;
}> {
  for (;;) {
    const cleanupCallbacks = new CallbackQueue("reverse");

    try {
      if (args["randomize-ports"]) {
        await runfiles.tmp.randomizePortsInRunfile();
      }

      if (typeof runSuffix === "string" && typeof runNumber === "number") {
        await changeOutputPath(runfiles, runSuffix);
        await runfiles.tmp.writeValue("Delay Scenario", "" + runNumber);
      }

      // The simulation has to be stopped to prevent start up race conditions.
      await runfiles.tmp.writeValue(
        "Break Day Offset",
        await runfiles.tmp.readValue("Start Day Offset")
      );
      await runfiles.tmp.writeValue(
        "Break Time",
        await runfiles.tmp.readValue("Start Time")
      );

      // Force enable OTD.
      await runfiles.tmp.writeValue("Use OTD-Communication", "1");
      await runfiles.tmp.writeValue("Route Setting and Reservation Mode", "2");

      // No matter what I do OpenTrack will close each connection right
      // after receiving the second request on it.
      //
      // const keepAlive = (await runfiles.tmp.readValue("Keep Connection")) === "1";

      const communicationLog = args["communication-log"];
      const delayScenario = await runfiles.tmp.readValue("Delay Scenario");
      const endTime = await runfiles.tmp.readDayTimeValue("stop");
      const hostApp = await runfiles.tmp.readValue("OTD Server");
      const hostOT = args["ot-host"];
      const keepAlive = false;
      const maxSimultaneousRequests = args["max-simultaneous-requests"];
      const outputPath = await runfiles.tmp.readValue("OutputPath");
      const portApp = +(await runfiles.tmp.readValue("OTD Server Port"));
      const portOT = +(await runfiles.tmp.readValue("OpenTrack Server Port"));
      const retry = args["max-retries"];

      log.info(`Delay Scenario: ${delayScenario}`);
      log.info(`Output Path: ${outputPath}`);
      log.info(`Hosts: OT ${hostOT} <-> App ${hostApp}`);
      log.info(`Ports: OT ${portOT} <-> App ${portApp}`);
      const otapi = new OTAPI({
        communicationLog,
        hostOT,
        keepAlive,
        log: log("OTAPI"),
        maxSimultaneousRequests,
        portApp,
        portOT,
        retry,
      });
      cleanupCallbacks.plan(otapi.kill.bind(otapi));

      const trainCounter = new TrainCounter(otapi);
      cleanupCallbacks.plan(trainCounter.start());

      const simulationRunning = new Deferred<void>();
      otapi.on("simPaused", (_, { time }): void => {
        if (time >= endTime) {
          simulationRunning.resolve();
        } else {
          otapi.setSimulationPauseTime({ time: endTime });
        }
      });

      if (args["log-ot-responses"]) {
        const debugCallback: AnyEventCallback = function (name, payload): void {
          process.stdout.write(
            `\n\n===> OT: ${name}\n${JSON.stringify(payload, null, 4)}\n\n`
          );
        };

        otapi.on(debugCallback);
      }

      await otapi.start();

      return {
        otapi,
        simulationRunning: simulationRunning.promise,
        trainCounter,
      };
    } catch (error) {
      log.error(error, "Preparations failed.");

      cleanupCallbacks.executeSerial();

      await new Promise(
        (resolve): void => void setTimeout(resolve, cooldownMs)
      );
      log.info("Trying again...");
      log.info();
    }
  }
}

type OvertakingParamsBase = Omit<OvertakingParams, "otapi">;
async function doOneRun(
  log: CurryLog,
  {
    overtakingParamsBase,
    runNumber,
    runSuffix,
    runfiles,
  }: {
    overtakingParamsBase: OvertakingParamsBase;
    runNumber?: number;
    runSuffix: string;
    runfiles: TmpRunfilePair;
  }
): Promise<void> {
  try {
    console.time("Single run");
    return retry(
      log,
      async ({ attempt }): Promise<void> => {
        try {
          console.time("Single run attempt");

          if (attempt > 1) {
            log.warn(`Starting rerun (attempt ${attempt})...`);
          } else {
            log.info("Starting run...");
          }

          const {
            command,
            otapi,
            simulationRunning,
            trainCounter,
          } = await startOpenTrackAndOTAPI(log("startup"), {
            runNumber,
            runSuffix,
            runfiles,
          });
          command.returnCode.catch().then(
            async (): Promise<void> => {
              log.info(
                `OpenTrack exited with exit code ${await command.returnCode}.`
              );
              log.info("Stopping the app...");
              otapi.kill();
            }
          );

          const { cleanup, setup } = overtaking({
            ...overtakingParamsBase,
            otapi,
          });
          try {
            await setup();

            // The simulation has to be stopped right before it ends to detect and
            // react to stuck trains situation.
            await otapi.setSimulationPauseTime({
              time: await runfiles.tmp.readDayTimeValue("stop"),
            });

            log.info("Starting simulation...");
            const simulationEnd = otapi.once("simStopped");
            const simulationContinued = otapi.once("simContinued");
            await startUnless(otapi);
            await simulationContinued;
            log.info("Simulating...");

            await simulationRunning;
            log.info("Simulation ended.");
            await cleanup();
            await continueUnless(otapi, trainCounter);
            await simulationEnd;

            // Wait for the process to finish. OpenTrack doesn't handle well when
            // the app stops responding when it's running.
            log.info("Waiting for OpenTrack to terminate...");
            await command.returnCode;
            log.info("OpenTrack closed.");
          } finally {
            await cleanup();
            await otapi.kill();
            log.info("OTAPI stopped.");
            log.info();
          }
        } finally {
          console.timeEnd("Single run attempt");
        }
      }
    ).result;
  } finally {
    console.timeEnd("Single run");
  }
}

const logFilePath = args["log-file"];
const log = curryLog(
  curryLogCleanConsoleConsumer,
  ...(logFilePath != null
    ? [createCurryLogStreamFileConsumer(logFilePath)]
    : [])
).get("index");

(async (): Promise<void> => {
  const [
    stopFilePath,
    runfiles,
    infrastructure,
    overtakingModules,
  ] = await Promise.all([
    (async (): Promise<string | null> => {
      const stopFilePath = args["stop-file"];
      if (stopFilePath != null) {
        await remove(stopFilePath);
      }
      return stopFilePath;
    })(),
    ((): Promise<TmpRunfilePair> => {
      return createTmpRunfilePair(
        args["ot-runfile"],
        args["ot-runfile"].endsWith(".txt")
          ? args["ot-runfile"].slice(0, -4) + ".tmp.txt"
          : args["ot-runfile"] + ".tmp.txt"
      );
    })(),
    (async (): Promise<Infrastructure> => {
      const infrastructure = await infrastructureFactory.buildFromFiles(
        log("infrastructure"),
        {
          courses: args["ot-export-courses"],
          infrastructureOTML: args["ot-export-infrastructure-otml"],
          infrastructureTrafIT: args["ot-export-infrastructure-trafit"],
          rollingStock: args["ot-export-rolling-stock"],
          timetables: args["ot-export-timetable"],
        }
      );

      log.info(
        [
          "Infrastructure:",

          `  ${infrastructure.trains.size} trains ` +
            `(${Math.min(
              ...[...infrastructure.trains.values()].map(
                (train): number => train.length
              )
            )} m shortest, ` +
            `${Math.max(
              ...[...infrastructure.trains.values()].map(
                (train): number => train.length
              )
            )} m longest, ` +
            `${Math.min(
              ...[...infrastructure.trains.values()].map(
                (train): number => train.maxSpeed
              )
            )} km/h slowest, ` +
            `${Math.max(
              ...[...infrastructure.trains.values()].map(
                (train): number => train.maxSpeed
              )
            )} km/h fastest),`,

          `  ${infrastructure.itineraries.size} itineraries ` +
            `(${infrastructure.itinerariesLength / 1000} km, ` +
            `${infrastructure.mainItineraries.size} used as main itineraries),`,

          `  ${infrastructure.paths.size} paths ` +
            `(${infrastructure.pathsLength / 1000} km),`,

          `  ${infrastructure.routes.size} routes ` +
            `(${infrastructure.routesLength / 1000} km).`,

          `  ${infrastructure.vertexes.size} vertexes,`,

          `  ${infrastructure.stations.size} stations,`,

          `  ${infrastructure.timetables.size} timetables.`,
        ].join("\n")
      );

      return infrastructure;
    })(),
    ((): Promise<readonly OvertakingModule[]> => {
      return Promise.all(
        args["overtaking-module"].map(
          async (confString): Promise<OvertakingModule> => {
            const [nameOrPath, outputDirName, paramsString] = confString.split(
              "?",
              3
            );

            const params =
              typeof paramsString === "string" && paramsString.length > 0
                ? (JSON.parse(paramsString) as Record<string, any>)
                : {};

            if (nameOrPath.includes("/") || nameOrPath.includes("\\")) {
              const path = nameOrPath;
              return {
                confString: confString,
                fsConfString: outputDirName,
                module: (
                  await import(resolve(process.cwd(), path))
                ).decisionModuleFactory.create(params),
              };
            } else if (
              Object.prototype.hasOwnProperty.call(
                decisionModuleFactories,
                nameOrPath
              )
            ) {
              const name = nameOrPath;
              return {
                confString,
                fsConfString: outputDirName,
                module: decisionModuleFactories[name].create(params),
              };
            } else {
              throw new Error(`Unknown module "${nameOrPath}".`);
            }
          }
        )
      );
    })(),
  ]);

  const overtakingParamsBase = {
    infrastructure,
    log: log("overtaking"),
  };

  if (
    args["test-connection-serial"] > 0 ||
    args["test-connection-parallel"] > 0
  ) {
    if (args["manage-ot"]) {
      const { command, otapi } = await startOpenTrackAndOTAPI(log("startup"), {
        runNumber: 1,
        runSuffix: "connection-test",
        runfiles,
      });
      command.returnCode.catch().then(
        async (): Promise<void> => {
          log.error(
            new Error("Process unexpectedly terminated."),
            `OpenTrack unexpectedly exited with exit code ${await command.returnCode}.`
          );
        }
      );

      await testConnection(
        log("connection-test"),
        otapi,
        args["test-connection-serial"],
        args["test-connection-parallel"]
      );

      log.info("Closing OpenTrack...");
      await otapi.terminateApplication();
    } else {
      const { otapi } = await prepareForRun(log("preparations"), runfiles);

      log.info("Waiting for OpenTrack...");
      await waitPort({
        host: otapi.config.hostOT,
        output: "dots",
        port: otapi.config.portOT,
      });

      await testConnection(
        log("connection-test"),
        otapi,
        args["test-connection-serial"],
        args["test-connection-parallel"]
      );
    }
  } else if (args["manage-ot"]) {
    const firstRunDelayScenario = args["delay-scenario-first"];
    const lastRunDelayScenario = args["delay-scenario-last"];

    if (firstRunDelayScenario === -1 && lastRunDelayScenario === -1) {
      for (const { fsConfString, module } of overtakingModules) {
        await doOneRun(log("run"), {
          overtakingParamsBase: { ...overtakingParamsBase, module },
          runSuffix: fsConfString,
          runfiles,
        });
      }
    } else if (
      Number.isInteger(firstRunDelayScenario) &&
      Number.isInteger(lastRunDelayScenario) &&
      1 <= Math.min(firstRunDelayScenario, lastRunDelayScenario) &&
      Math.max(firstRunDelayScenario, lastRunDelayScenario) <= 200
    ) {
      for (
        let runNumber = firstRunDelayScenario;
        Math.min(firstRunDelayScenario, lastRunDelayScenario) <= runNumber &&
        runNumber <= Math.max(firstRunDelayScenario, lastRunDelayScenario);
        runNumber += firstRunDelayScenario < lastRunDelayScenario ? 1 : -1
      ) {
        for (const { fsConfString, module } of overtakingModules) {
          await doOneRun(log("run", "" + runNumber), {
            overtakingParamsBase: { ...overtakingParamsBase, module },
            runNumber,
            runSuffix: fsConfString,
            runfiles,
          });
        }
        if (stopFilePath != null && (await pathExists(stopFilePath))) {
          await remove(stopFilePath);
          break;
        }
      }
    } else {
      throw new TypeError(
        "First and last run options have to be in <1, 200> integer range."
      );
    }
  } else {
    if (overtakingModules.length > 1) {
      throw new Error("There can be only one module without --manage-ot.");
    }
    const [{ module }] = overtakingModules;

    const { otapi } = await prepareForRun(log("preparations"), runfiles);

    log.info("Waiting for OpenTrack...");
    await waitPort({
      host: otapi.config.hostOT,
      output: "dots",
      port: otapi.config.portOT,
    });

    for (;;) {
      const { setup, cleanup } = overtaking({
        ...overtakingParamsBase,
        module,
        otapi,
      });
      await setup();

      const simulationStart = otapi.once("simStarted");

      log.info("Simulation can be started now.");
      await simulationStart;
      const simulationEnd = otapi.once("simStopped");
      log.info("Simulating...");

      await simulationEnd;
      log.info("Simulation ended.");
      await cleanup();
      log.info();
    }
  }
})()
  .then((): void => {
    process.exit(0);
  })
  .catch((error): void => {
    log.error(error, "An error bubbled all the way up, no idea what to do.");
    process.exit(1);
  });
