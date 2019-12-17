import { promisify } from "util";
import {
  readFile as readFileCallback,
  writeFile as writeFileCallback
} from "fs";
import { spawn } from "child_process";

import { AnyEventCallback, OTAPI, parseRunfile } from "./otapi";

const readFile = promisify(readFileCallback);
const writeFile = promisify(writeFileCallback);

const otBinaryPath =
  "/mnt/c/Program Files (x86)/OpenTrack V1.9/OpenTrack.app/OpenTrack.exe";
const otRunfile = "/mnt/c/Users/st46664/Documents/Model/runfile.txt";
const otLog = "/mnt/c/Users/st46664/Documents/Model/OpenTrack.log";

function spawnAndLog(
  binaryPath: string,
  args: string[],
  logPath: string
): Promise<{ code: number }> {
  return new Promise((resolve, reject): void => {
    let stdout = "";
    let stderr = "";

    const command = spawn(binaryPath, args);

    command.stdout.on("data", (data): void => {
      stdout += data.toString();
    });
    command.stderr.on("data", (data): void => {
      stderr += data.toString();
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
        .then(resolve.bind(null, { code }))
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
    "-scriptinit",
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

    otapi.on(debugCallback);

    const sumlationStart = otapi.once("simStarted");
    const simulationEnd = otapi.once("simStopped");

    console.info("Starting OpenTrack...");
    console.info([otBinaryPath, ...otArgs]);
    const command = spawnAndLog(otBinaryPath, otArgs, otLog);

    console.info("Waiting for OpenTrack...");
    await sumlationStart;
    console.info("OpenTrack has started the simulation.");

    await simulationEnd;
    console.info("Simulation ended.");

    const { code } = await command;
    console.info(`OpenTrack exited with exit code ${code}.`);
  } finally {
    otapi.off(debugCallback);
    await otapi.stop();
    console.info("Finished.");
  }
})().catch((error): void => {
  console.error(error);
  process.exit(1);
});
