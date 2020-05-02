import waitPort from "wait-port";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { promisify } from "util";
import { resolve, sep } from "path";
import { writeFile as writeFileCallback } from "fs";

import { AnyEventCallback, OTAPI, Runfile, cloneRunfile } from "./otapi";
import { CallbackQueue, Deferred } from "./util";
import { args } from "./cli";
import { buildChunkLogger } from "./util";
import { infrastructureFactory } from "./infrastructure";
import { TrainCounter } from "./train-counter";
import { testConnection } from "./connection-test";
import {
  CurryLog,
  createCurryLogFileConsumer,
  curryLog,
  curryLogCleanConsoleConsumer,
} from "./curry-log";

import { overtaking, OvertakingParams, DecisionModule } from "./overtaking";

const writeFile = promisify(writeFileCallback);

const cooldownMs = 10000;

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
    runfile,
  }: {
    runNumber?: number;
    runSuffix: string;
    runfile: Runfile;
  }
): Promise<{
  command: ReturnType<typeof spawnAndLog>;
  otapi: OTAPI;
  trainCounter: TrainCounter;
}> {
  const otArgs = Object.freeze(["-otd", `-runfile=${runfile.path}`]);
  log.info("OpenTrack commandline:", [args["ot-binary"], ...otArgs]);

  for (let attempt = 1; ; ++attempt) {
    const cleanupCallbacks: (() => Promise<void>)[] = [];

    try {
      const { otapi, trainCounter } = await prepareForRun(
        log("preparations"),
        runfile,
        runSuffix,
        runNumber
      );
      cleanupCallbacks.push(otapi.kill.bind(otapi));

      const readyForSimulation = otapi.once("simReadyForSimulation");
      const simulationServerStarted = otapi.once("simServerStarted");

      const failed = new Deferred();
      setTimeout((): void => {
        if (failed.pending) {
          failed.reject(new Error("Timed out."));
        }
      }, 120 * 1000);

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
            failed.reject(new Error(line));
          }
        }
      );
      cleanupCallbacks.push(
        async (): Promise<void> => {
          log.info("Waiting for OpenTrack process to terminate...");
          command.child.kill("SIGTERM");
          await command.returnCode;
          log.info("OpenTrack terminated.");
        }
      );

      await Promise.race([
        Promise.all([
          readyForSimulation,
          simulationServerStarted,
          waitPort({ port: otapi.config.portOT, output: "silent" }),
        ]),
        failed.promise,
      ]);
      log.info("OpenTrack is ready for simulation.");
      await otapi.openSimulationPanel({ mode: "Simulation" });
      log.info("OpenTrack responds to requests.");

      return { command, otapi, trainCounter };
    } catch (error) {
      log.error(error, "Startup failed.");

      for (const callback of cleanupCallbacks.splice(0).reverse()) {
        await callback();
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
  runfile: Runfile,
  runSuffix: string,
  runNumber: number
): Promise<void> {
  const path = (await runfile.readValue("OutputPath")).split(sep);

  // Remove trailing separator.
  if (path[path.length - 1] === "") {
    path.pop();
  }

  // Remove old run number.
  if (/^run-\d+-/.test(path[path.length - 1])) {
    path.pop();
  }

  // Add current run number.
  path.push(`run-${runNumber}-${runSuffix}`);

  await runfile.writeValue("OutputPath", path.join(sep));
}

async function prepareForRun(
  log: CurryLog,
  runfile: Runfile,
  runSuffix?: string,
  runNumber?: number
): Promise<{ otapi: OTAPI; trainCounter: TrainCounter }> {
  for (;;) {
    const cleanupCallbacks = new CallbackQueue("reverse");

    try {
      if (args["randomize-ports"]) {
        await runfile.randomizePortsInRunfile();
      }

      if (typeof runSuffix === "string" && typeof runNumber === "number") {
        await changeOutputPath(runfile, runSuffix, runNumber);
        await runfile.writeValue("Delay Scenario", "" + runNumber);
        await runfile.writeValue("Route Setting and Reservation Mode", "2");
      }

      // The simulation has to be stopped right before it ends to detect and
      // react to stuck trains situation.
      await runfile.writeValue(
        "Break Time",
        await runfile.readValue("Stop Time")
      );

      // Force enable OTD.
      await runfile.writeValue("Use OTD-Communication", "1");

      // No matter what I do OpenTrack will close each connection right
      // after receiving the second request on it.
      //
      // const keepAlive = (await runfile.readValue("Keep Connection")) === "1";

      const communicationLog = args["communication-log"];
      const delayScenario = await runfile.readValue("Delay Scenario");
      const endTime = await runfile.readTimeValue("Stop Time");
      const hostApp = await runfile.readValue("OTD Server");
      const hostOT = args["ot-host"];
      const keepAlive = false;
      const maxSimultaneousRequests = args["max-simultaneous-requests"];
      const outputPath = await runfile.readValue("OutputPath");
      const portApp = +(await runfile.readValue("OTD Server Port"));
      const portOT = +(await runfile.readValue("OpenTrack Server Port"));

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
      });
      cleanupCallbacks.plan(otapi.kill.bind(otapi));

      const trainCounter = new TrainCounter(otapi);
      cleanupCallbacks.plan(trainCounter.start());
      otapi.on("simPaused", (_, { time }): void => {
        if (time === endTime) {
          if (trainCounter.size > 0) {
            // This simulation run failed.
            log.warn(`${trainCounter.size} stuck trains.`);

            // Let's debug if a debugger is attached.
            // eslint-disable-next-line no-debugger
            debugger;
          }

          // Continue.
          otapi.startSimulation().catch((error): void => {
            log.error(error, "Failed to resume simulation.");
          });
        }
      });

      if (args["log-ot-responses"]) {
        const debugCallback: AnyEventCallback = async function (
          name,
          payload
        ): Promise<void> {
          process.stdout.write(
            `\n\n===> OT: ${name}\n${JSON.stringify(payload, null, 4)}\n\n`
          );
        };

        otapi.on(debugCallback);
      }

      await otapi.start();

      return { otapi, trainCounter };
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
    runfile,
  }: {
    overtakingParamsBase: OvertakingParamsBase;
    runNumber?: number;
    runfile: Runfile;
  }
): Promise<void> {
  log.info();

  const { command, otapi } = await startOpenTrackAndOTAPI(log("startup"), {
    runNumber,
    runSuffix: overtakingParamsBase.defaultModule,
    runfile,
  });
  command.returnCode.catch().then(
    async (): Promise<void> => {
      log.info(`OpenTrack exited with exit code ${await command.returnCode}.`);
      log.info("Stopping the app...");
      otapi.kill();
    }
  );

  try {
    const { cleanup, setup } = overtaking({
      ...overtakingParamsBase,
      otapi,
    });
    await setup();

    log.info("Starting simulation...");
    const simulationEnd = otapi.once("simStopped");
    const simulationStart = otapi.once("simStarted");
    await otapi.startSimulation();
    await simulationStart;
    log.info("Simulating...");

    await simulationEnd;
    log.info("Simulation ended.");
    await cleanup();

    log.info("Closing OpenTrack...");
    await otapi.terminateApplication();

    // Wait for the process to finish. OpenTrack doesn't handle well when the
    // app stops responding when it's running.
    await command.returnCode;
    log.info("OpenTrack closed.");
  } finally {
    await otapi.kill();
    log.info("OTAPI stopped.");
    log.info();
  }
}

const logFilePath = args["log-file"];
const log = curryLog(
  curryLogCleanConsoleConsumer,
  ...(logFilePath != null ? [createCurryLogFileConsumer(logFilePath)] : [])
).get("index");

(async (): Promise<void> => {
  const runfile = await cloneRunfile(
    args["ot-runfile"],
    args["ot-runfile"].endsWith(".txt")
      ? args["ot-runfile"].slice(0, -4) + ".tmp.txt"
      : args["ot-runfile"] + ".tmp.txt"
  );

  const infrastructure = await infrastructureFactory.buildFromFiles(
    log("infrastructure"),
    {
      courses: args["ot-export-courses"],
      infrastructure: args["ot-export-infrastructure"],
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

  const overtakingModules = await Promise.all(
    (args["overtaking-modules"] ?? []).map(
      async (path): Promise<DecisionModule> => {
        return (await import(resolve(process.cwd(), path))).decisionModule;
      }
    )
  );
  const overtakingParamsBase = {
    defaultModule: args["overtaking-default-module"],
    infrastructure,
    log: log("overtaking"),
    modules: overtakingModules,
  };

  if (
    args["test-connection-serial"] > 0 ||
    args["test-connection-parallel"] > 0
  ) {
    if (args["manage-ot"]) {
      const { command, otapi } = await startOpenTrackAndOTAPI(log("startup"), {
        runNumber: 1,
        runSuffix: "connection-test",
        runfile,
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
      const { otapi } = await prepareForRun(log("preparations"), runfile);

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
    if (args["runs"] >= 0) {
      for (let runNumber = 1; runNumber <= args["runs"]; ++runNumber) {
        await doOneRun(log("run", "" + runNumber), {
          overtakingParamsBase,
          runNumber,
          runfile,
        });
        if (args["control-runs"]) {
          await doOneRun(log("run", "control", "" + runNumber), {
            overtakingParamsBase: {
              ...overtakingParamsBase,
              defaultModule: "do-nothing",
            },
            runNumber,
            runfile,
          });
        }
      }
    } else {
      await doOneRun(log("run"), { overtakingParamsBase, runfile });
    }
  } else {
    const { otapi } = await prepareForRun(log("preparations"), runfile);

    log.info("Waiting for OpenTrack...");
    await waitPort({
      host: otapi.config.hostOT,
      output: "dots",
      port: otapi.config.portOT,
    });

    for (;;) {
      const { setup, cleanup } = overtaking({
        ...overtakingParamsBase,
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
    log.error(error);
    process.exit(1);
  });
