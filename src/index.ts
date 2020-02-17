import waitPort from "wait-port";
import { promisify } from "util";
import { resolve } from "path";
import {
  readFile as readFileCallback,
  writeFile as writeFileCallback
} from "fs";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

import {
  AnyEventCallback,
  OTAPI,
  parseRunfile,
  randomizePortsInRunfile
} from "./otapi";
import { Deferred } from "./util";
import { TrainTracker } from "./train-tracker";
import { args } from "./cli";
import { buildChunkLogger } from "./util";
import { infrastructureFactory } from "./infrastructure";

import { overtaking, OvertakingParams, DecisionModule } from "./overtaking";

const readFile = promisify(readFileCallback);
const writeFile = promisify(writeFileCallback);

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
    const logStderr = buildChunkLogger("OT", "error", onLogLine);

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
          `STDERR:\n${stderr}`
        ].join("\n\n")
      )
        .then(resolve.bind(null, code))
        .catch(reject);
    });
  });

  return { child, returnCode };
}

async function startOpenTrack(otapi: OTAPI): Promise<{ command: any }> {
  const otArgs = Object.freeze(["-otd", `-runfile=${args["ot-runfile"]}`]);
  console.info("OpenTrack commandline:", [args["ot-binary"], ...otArgs]);

  for (let attempt = 1; ; ++attempt) {
    const readyForSimulation = otapi.once("simReadyForSimulation");
    const simulationServerStarted = otapi.once("simServerStarted");

    const failed = new Deferred();

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
          line.endsWith("OTServerGenerator startPSMServer Socket NO success")
        ) {
          failed.reject(new Error(line));
        }
      }
    );

    try {
      await Promise.race([
        Promise.all([
          readyForSimulation,
          simulationServerStarted,
          waitPort({ port: otapi.config.portOT, output: "silent" })
        ]),
        failed.promise
      ]);
      await otapi.openSimulationPanel();
      console.info("OpenTrack is ready for simulation.");

      return { command };
    } catch (error) {
      console.error("Startup failed.");

      console.info("Waiting for OpenTrack process to terminate...");
      command.child.kill("SIGTERM");
      await command.returnCode;
      console.info("OpenTrack terminated.");

      console.info("Trying again...");
      console.info();
      continue;
    }
  }
}

(async (): Promise<void> => {
  if (args["randomize-ports"]) {
    await randomizePortsInRunfile(args["ot-runfile"]);
  }
  const runfile = parseRunfile((await readFile(args["ot-runfile"])).toString());
  const portOT = +runfile["OpenTrack Server Port"][0];
  const portApp = +runfile["OTD Server Port"][0];

  const infrastructure = await infrastructureFactory.buildFromFiles({
    courses: args["ot-export-courses"],
    infrastructure: args["ot-export-infrastructure"],
    rollingStock: args["ot-export-rolling-stock"],
    timetables: args["ot-export-timetable"]
  });

  console.info(
    [
      "Infrastructure:",

      `  ${infrastructure.trains.size} trains,`,

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
      ""
    ].join("\n")
  );

  console.info(`Ports: OT ${portOT} <-> App ${portApp}`);
  const otapi = new OTAPI({ portApp, portOT });
  const trainTracker = new TrainTracker(otapi, infrastructure);

  const overtakingModules = await Promise.all(
    (args["overtaking-modules"] ?? []).map(
      async (path): Promise<DecisionModule> => {
        return (await import(resolve(process.cwd(), path))).decisionModule;
      }
    )
  );
  const overtakingParams: OvertakingParams = {
    defaultModule: args["overtaking-default-module"],
    infrastructure,
    modules: overtakingModules,
    otapi
  };

  try {
    trainTracker.startTracking(1);
    await otapi.start();

    if (args["log-ot-responses"]) {
      const debugCallback: AnyEventCallback = async function(
        name,
        payload
      ): Promise<void> {
        process.stdout.write(
          `\n\n===> OT: ${name}\n${JSON.stringify(payload, null, 4)}\n\n`
        );
      };

      otapi.on(debugCallback);
    }

    if (args["manage-ot"]) {
      const { command } = await startOpenTrack(otapi);
      command.returnCode.catch().then(
        async (): Promise<void> => {
          console.info(
            `OpenTrack exited with exit code ${await command.returnCode}.`
          );
          console.info("Stopping the app...");
          otapi.kill();
        }
      );

      const { cleanup, setup } = overtaking(overtakingParams);
      await setup();

      const simulationEnd = otapi.once("simStopped");
      console.info("Starting simulation...");
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
    } else {
      console.info("Waiting for OpenTrack...");
      await waitPort({ port: portOT, output: "silent" });

      for (;;) {
        const { setup, cleanup } = overtaking(overtakingParams);
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
  } finally {
    await otapi.kill();
    console.info("Finished.");
    console.info();
  }
})()
  .then((): void => {
    process.exit(0);
  })
  .catch((error): void => {
    console.error(error);
    process.exit(1);
  });
