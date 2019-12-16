import { promisify } from "util";
import { readFile as readFileCallback } from "fs";
import { spawn } from "child_process";

import { AnyEventCallback, OTAPI, parseRunfile } from "./otapi";

const readFile = promisify(readFileCallback);

const otBinaryPath =
  "/mnt/c/Program Files (x86)/OpenTrack V1.9/OpenTrack.app/OpenTrack.exe";
const otRunfile = "/mnt/c/Users/st46664/Documents/Model/runfile.txt";

(async (): Promise<void> => {
  const runfile = parseRunfile((await readFile(otRunfile)).toString());
  const portOT = +runfile["OpenTrack Server Port"][0];
  const portApp = +runfile["OTD Server Port"][0];

  const otapi = new OTAPI({ portApp, portOT });

  const anyCallback: AnyEventCallback = async function(
    name,
    payload
  ): Promise<void> {
    process.stdout.write(
      `\n\n===> OT: ${name}\n${JSON.stringify(payload, null, 4)}\n\n`
    );
  };

  try {
    await otapi.start();

    otapi.on(anyCallback);

    const sumlationStart = otapi.once("simStarted");
    const simulationEnd = otapi.once("simStopped");

    console.info("Starting OpenTrack...");
    console.info([otBinaryPath, "-otd", "-scriptinit", "-runfile", otRunfile]);
    spawn(otBinaryPath, ["-otd", "-scriptinit", "-runfile", otRunfile]);

    console.info("Waiting for OpenTrack...");
    await sumlationStart;
    console.info("OpenTrack has started the simulation.");

    await simulationEnd;
    console.info("Simulation ended.");
  } catch (error) {
    console.error(error);
  } finally {
    otapi.off(anyCallback);
    await otapi.stop();
    console.info("Finished.");
  }
})().catch((error): void => {
  console.error(error);
  process.exit(1);
});
