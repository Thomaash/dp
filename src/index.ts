import waitPort from "wait-port";
import { promisify } from "util";
import {
  readFile as readFileCallback,
  writeFile as writeFileCallback
} from "fs";
import { spawn } from "child_process";

import { AnyEventCallback, OTAPI, parseRunfile } from "./otapi";
import { Deferred } from "./util";
import { args } from "./cli";
import { buildChunkLogger } from "./util";
import { parseInfrastructure } from "./infrastructure";

const readFile = promisify(readFileCallback);
const writeFile = promisify(writeFileCallback);

const otBinaryPath =
  "/mnt/c/Program Files (x86)/OpenTrack V1.9/OpenTrack.app/OpenTrack.exe";
const otInfrastructure =
  "/mnt/c/Users/st46664/Documents/Model/Exports/infrastructure.xml";
const otLog = "/mnt/c/Users/st46664/Documents/Model/OpenTrack.log";
const otRunfile = "/mnt/c/Users/st46664/Documents/Model/runfile.txt";

function main(
  otapi: OTAPI,
  otReady: Promise<void>
): { preparing: Promise<void>; running: Promise<void> } {
  const preparing = (async (): Promise<void> => {
    await Promise.all([
      otapi.on(
        "trainCreated",
        async (_, { time, trainID }): Promise<void> => {
          const departureTime = Math.round(time + 600) + 0.1;

          try {
            await otapi.setWaitForDepartureCommand({ trainID, flag: true });
            await otapi.setDepartureCommand({ trainID, time: departureTime });
          } catch (error) {
            console.error("configure new train", error);
          }
        }
      ),
      otapi.on("trainArrival", (_, { time, trainID }): void => {
        const departureTime = Math.round(time + 600) + 0.1;
        otapi
          .setDepartureCommand({ trainID, time: departureTime })
          .catch(console.error.bind(console, "set departure command"));
      })
    ]);
  })();

  const running = (async (): Promise<void> => {
    await preparing;
    await otReady;
  })();

  return { preparing, running };
}

function spawnAndLog(
  binaryPath: string,
  args: string[],
  logPath: string
): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject): void => {
    let stdout = "";
    let stderr = "";

    const logStdout = buildChunkLogger("OT", "info");
    const logStderr = buildChunkLogger("OT", "error");

    const command = spawn(binaryPath, args);

    command.stdout.on("data", (chunk): void => {
      const string: string = chunk.toString();

      stdout += string;
      logStdout(string);
    });
    command.stderr.on("data", (chunk): void => {
      const string: string = chunk.toString();

      stderr += string;
      logStderr(string);
    });

    command.on("close", (code): void => {
      writeFile(
        logPath,
        [
          `OpenTrack exited with exit code ${code}.`,
          `STDOUT:\n${stdout}`,
          `STDERR:\n${stderr}`
        ].join("\n\n")
      )
        .then(resolve.bind(null, { code, stderr, stdout }))
        .catch(reject);
    });
  });
}

(async (): Promise<void> => {
  const runfile = parseRunfile((await readFile(otRunfile)).toString());
  const portOT = +runfile["OpenTrack Server Port"][0];
  const portApp = +runfile["OTD Server Port"][0];

  const otArgs = [
    "-otd",
    // "-scriptinit",
    `-runfile=${
      otRunfile.startsWith("/mnt/")
        ? `${
            // Uppercase drive letter.
            otRunfile.slice(5, 6).toUpperCase()
          }:${
            // The relative path on given drive with backslashes instead of shlashes.
            otRunfile.slice(6).replace(/\//g, "\\")
          }`
        : otRunfile
    }`
  ];

  const otapi = new OTAPI({ portApp, portOT });

  try {
    const infrastructure = await parseInfrastructure(
      await readFile(otInfrastructure, "utf-8")
    );

    process.stdout.write(
      [
        "Infrastructure:",

        `  ${infrastructure.itineraries.size} itineraries ` +
          `(${infrastructure.itinerariesLength / 1000} km),`,

        `  ${infrastructure.paths.size} paths ` +
          `(${infrastructure.pathsLength / 1000} km),`,

        `  ${infrastructure.routes.size} routes ` +
          `(${infrastructure.routesLength / 1000} km).`,

        "",
        ""
      ].join("\n")
    );

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
      const ready = new Deferred<void>();
      const { preparing, running } = main(otapi, ready.promise);

      const readyForSimulation = otapi.once("simReadyForSimulation");
      const simulationServerStarted = otapi.once("simServerStarted");

      console.info("Starting OpenTrack...");
      console.info([otBinaryPath, ...otArgs]);
      const command = spawnAndLog(otBinaryPath, otArgs, otLog);
      command.then(otapi.kill.bind(otapi)).catch(otapi.kill.bind(otapi));

      console.info("Waiting for OpenTrack...");
      await Promise.all([
        preparing,
        readyForSimulation,
        simulationServerStarted,
        waitPort({ port: portOT, output: "silent" })
      ]);
      const simulationEnd = otapi.once("simStopped");
      console.info("Starting simulation...");
      const simulationStart = otapi.once("simStarted");
      await otapi.startSimulation();
      await simulationStart;
      console.info("Simulating...");

      ready.resolve();
      await running;

      await simulationEnd;
      console.info("Simulation ended.");

      console.info("Closing OpenTrack...");
      await otapi.terminateApplication();
      console.info("OpenTrack closed.");

      const { code } = await command;
      console.info(`OpenTrack exited with exit code ${code}.`);
    } else {
      console.info("Waiting for OpenTrack...");
      await waitPort({ port: portOT, output: "silent" });

      for (;;) {
        const ready = new Deferred<void>();
        const { preparing, running } = main(otapi, ready.promise);
        await preparing;

        const simulationStart = otapi.once("simStarted");

        console.info("Simulation can be started now.");
        await simulationStart;
        const simulationEnd = otapi.once("simStopped");
        console.info("Simulating...");

        ready.resolve();
        await running;

        await simulationEnd;
        console.info("Simulation ended.");
        console.info();
      }
    }
  } finally {
    await otapi.kill();
    console.info("Finished.");
  }
})().catch((error): void => {
  console.error(error);
  process.exit(1);
});
