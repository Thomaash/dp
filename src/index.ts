import waitPort from "wait-port";
import { promisify } from "util";
import { resolve, sep } from "path";
import { writeFile as writeFileCallback } from "fs";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

import { AnyEventCallback, OTAPI, Runfile } from "./otapi";
import { CallbackQueue, Deferred } from "./util";
import { args } from "./cli";
import { buildChunkLogger } from "./util";
import { infrastructureFactory } from "./infrastructure";
import { TrainCounter } from "./train-counter";

import { overtaking, OvertakingParams, DecisionModule } from "./overtaking";

const writeFile = promisify(writeFileCallback);

const cooldownMs = 10000;

function spawnAndLog(
  binaryPath: string,
  args: readonly string[],
  logPath: string,
  onLogLine: (logLine: string) => void = (): void => {}
): { child: ChildProcessWithoutNullStreams; returnCode: Promise<number> } {
  const child = spawn(binaryPath, args);

  const returnCode = new Promise<number>((resolve, reject): void => {
    let stdout = "";
    let stderr = "";

    const logStdout = buildChunkLogger("OT", "info", onLogLine);
    const logStderr = buildChunkLogger("OT", "info", onLogLine);

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

async function startOpenTrackAndOTAPI({
  runNumber,
  runSuffix,
  runfile,
}: {
  runNumber?: number;
  runSuffix: string;
  runfile: Runfile;
}): Promise<{
  command: ReturnType<typeof spawnAndLog>;
  otapi: OTAPI;
  trainCounter: TrainCounter;
}> {
  const otArgs = Object.freeze(["-otd", `-runfile=${args["ot-runfile"]}`]);
  console.info("OpenTrack commandline:", [args["ot-binary"], ...otArgs]);

  for (let attempt = 1; ; ++attempt) {
    const cleanupCallbacks: (() => Promise<void>)[] = [];

    try {
      const { otapi, trainCounter } = await prepareForRun(
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

      console.info(
        attempt === 1
          ? "Starting OpenTrack..."
          : `Starting OpenTrack (attempt ${attempt})...`
      );
      const command = spawnAndLog(
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
          console.info("Waiting for OpenTrack process to terminate...");
          command.child.kill("SIGTERM");
          await command.returnCode;
          console.info("OpenTrack terminated.");
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
      console.info("OpenTrack is ready for simulation.");
      await otapi.openSimulationPanel({ mode: "Simulation" });
      console.info("OpenTrack responds to requests.");

      return { command, otapi, trainCounter };
    } catch (error) {
      console.error("Startup failed.");

      for (const callback of cleanupCallbacks.splice(0).reverse()) {
        await callback();
      }

      await new Promise(
        (resolve): void => void setTimeout(resolve, cooldownMs)
      );
      console.info("Trying again...");
      console.info();
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
        await runfile.writeValue("Delay Scenario", runNumber);
      }

      // The simulation has to be stopped right before it ends to detect and
      // react to stuck trains situation.
      await runfile.writeValue(
        "Break Time",
        await runfile.readValue("Stop Time")
      );

      const communicationLog = args["communication-log"];
      const delayScenario = await runfile.readValue("Delay Scenario");
      const endTime = await runfile.readTimeValue("Stop Time");
      const keepAlive = (await runfile.readValue("Keep Connection")) === "1";
      const outputPath = await runfile.readValue("OutputPath");
      const portApp = +(await runfile.readValue("OTD Server Port"));
      const portOT = +(await runfile.readValue("OpenTrack Server Port"));

      console.info(`Delay Scenario: ${delayScenario}`);
      console.info(`Output Path: ${outputPath}`);
      console.info(`Ports: OT ${portOT} <-> App ${portApp}`);
      const otapi = new OTAPI({
        communicationLog,
        keepAlive,
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
            console.error(`${trainCounter.size} stuck trains.`);

            // Let's debug if a debugger is attached.
            // eslint-disable-next-line no-debugger
            debugger;
          }

          // Continue.
          otapi.startSimulation().catch((error): void => {
            console.error("Failed to resume simulation.");
            console.error(error);
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
      console.error("Preparations failed.");

      cleanupCallbacks.executeSerial();

      await new Promise(
        (resolve): void => void setTimeout(resolve, cooldownMs)
      );
      console.info("Trying again...");
      console.info();
    }
  }
}

type OvertakingParamsBase = Omit<OvertakingParams, "otapi">;
async function doOneRun({
  overtakingParamsBase,
  runNumber,
  runfile,
}: {
  overtakingParamsBase: OvertakingParamsBase;
  runNumber?: number;
  runfile: Runfile;
}): Promise<void> {
  console.info();

  const { command, otapi, trainCounter } = await startOpenTrackAndOTAPI({
    runNumber,
    runSuffix: overtakingParamsBase.defaultModule,
    runfile,
  });
  command.returnCode.catch().then(
    async (): Promise<void> => {
      console.info(
        `OpenTrack exited with exit code ${await command.returnCode}.`
      );
      console.info("Stopping the app...");
      otapi.kill();
    }
  );

  try {
    const { cleanup, setup } = overtaking({
      ...overtakingParamsBase,
      otapi,
    });
    await setup();

    console.info("Starting simulation...");
    const simulationEnd = otapi.once("simStopped");
    const simulationStart = otapi.once("simStarted");
    await otapi.startSimulation();
    await simulationStart;
    console.info("Simulating...");

    await simulationEnd;
    console.info("Simulation ended.");
    await cleanup();

    console.info("Closing OpenTrack...");
    await otapi.terminateApplication();

    // Wait for the process to finish. OpenTrack doesn't handle well when the
    // app stops responding when it's running.
    await command.returnCode;
    console.info("OpenTrack closed.");
  } finally {
    await otapi.kill();
    console.info("OTAPI stopped.");
    console.info();
  }
}

(async (): Promise<void> => {
  const runfile = new Runfile(args["ot-runfile"]);

  const infrastructure = await infrastructureFactory.buildFromFiles({
    courses: args["ot-export-courses"],
    infrastructure: args["ot-export-infrastructure"],
    rollingStock: args["ot-export-rolling-stock"],
    timetables: args["ot-export-timetable"],
  });

  console.info(
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

      "",
      "",
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
    modules: overtakingModules,
  };

  if (args["manage-ot"]) {
    if (args["runs"] >= 0) {
      for (let runNumber = 1; runNumber <= args["runs"]; ++runNumber) {
        await doOneRun({ overtakingParamsBase, runNumber, runfile });
        if (args["control-runs"]) {
          await doOneRun({
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
      await doOneRun({ overtakingParamsBase, runfile });
    }
  } else {
    const { otapi, trainCounter } = await prepareForRun(runfile);

    console.info("Waiting for OpenTrack...");
    await waitPort({ port: otapi.config.portOT, output: "silent" });

    for (;;) {
      const { setup, cleanup } = overtaking({
        ...overtakingParamsBase,
        otapi,
      });
      await setup();

      const simulationStart = otapi.once("simStarted");

      console.info("Simulation can be started now.");
      await simulationStart;
      const simulationEnd = otapi.once("simStopped");
      console.info("Simulating...");

      await simulationEnd;
      console.info("Simulation ended.");
      await cleanup();
      console.info();
    }
  }
})()
  .then((): void => {
    process.exit(0);
  })
  .catch((error): void => {
    console.error(error);
    process.exit(1);
  });
