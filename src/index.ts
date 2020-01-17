import waitPort from "wait-port";
import { promisify } from "util";
import {
  readFile as readFileCallback,
  writeFile as writeFileCallback
} from "fs";
import { spawn } from "child_process";

import { AnyEventCallback, OTAPI, parseRunfile } from "./otapi";
import { buildChunkLogger } from "./util";

const readFile = promisify(readFileCallback);
const writeFile = promisify(writeFileCallback);

const otBinaryPath =
  "/mnt/c/Program Files (x86)/OpenTrack V1.9/OpenTrack.app/OpenTrack.exe";
const otRunfile = "/mnt/c/Users/st46664/Documents/Model/runfile.txt";
const otLog = "/mnt/c/Users/st46664/Documents/Model/OpenTrack.log";

async function main(otapi: OTAPI): Promise<void> {
  await Promise.all([
    otapi.on("trainCreated", (_, { trainID }): void => {
      otapi
        .setWaitForDepartureCommand({ trainID, flag: true })
        .catch(console.error.bind(console, "set wait for departure command"));
    }),
    otapi.on("trainArrival", (_, { delay, time, trainID }): void => {
      const departureTime = time + (600 - delay);
      otapi.setDepartureCommand({ trainID, time: departureTime });
    })
  ]);

  await otapi.startSimulation();
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

  const debugCallback: AnyEventCallback = async function(
    name,
    payload
  ): Promise<void> {
    process.stdout.write(
      `\n\n===> OT: ${name}\n${JSON.stringify(payload, null, 4)}\n\n`
    );
  };

  try {
    await otapi.start();

    // otapi.on(debugCallback);

    const readyForSimulation = otapi.once("simReadyForSimulation");
    const simulationEnd = otapi.once("simStopped");
    const simulationServerStarted = otapi.once("simServerStarted");
    // const simulationStart = otapi.once("simStarted");

    console.info("Starting OpenTrack...");
    console.info([otBinaryPath, ...otArgs]);
    const command = spawnAndLog(otBinaryPath, otArgs, otLog);
    command.then(otapi.kill.bind(otapi)).catch(otapi.kill.bind(otapi));

    console.info("Waiting for OpenTrack...");
    await Promise.all([
      (async (): Promise<void> => {
        await readyForSimulation;
        console.info("OpenTrack is ready for simulation.");
      })(),
      (async (): Promise<void> => {
        await simulationServerStarted;
        console.info("OpenTrack has started simulation server.");
      })(),
      // (async (): Promise<void> => {
      //   await simulationStart;
      //   console.info("OpenTrack has started the simulation.");
      // })(),
      (async (): Promise<void> => {
        await waitPort({ port: portOT, output: "silent" });
        console.info("OpenTrack has started the OTD server.");
      })()
    ]);
    console.info("Everything's ready.");

    main(otapi);

    await simulationEnd;
    console.info("Simulation ended.");

    const { code } = await command;
    console.info(`OpenTrack exited with exit code ${code}.`);
  } finally {
    await otapi.kill();
    console.info("Finished.");
  }
})().catch((error): void => {
  console.error(error);
  process.exit(1);
});
