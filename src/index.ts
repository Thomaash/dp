import { promisify } from "util";
import { readFile as readFileCallback } from "fs";
import { spawn } from "child_process";

import { AnyEventCallback, OTAPI, parseRunfile } from "./otapi";

const readFile = promisify(readFileCallback);

const otBinaryPath =
  "/mnt/c/Program Files (x86)/OpenTrack V1.9/OpenTrack.app/OpenTrack.exe";
const otRunfile = "/mnt/c/Users/st46664/Documents/Model/runfile.txt";

// function watchDog(otapi: OTAPI): () => void {
//   let counter = 0;
//   const callback = (): void => void ++counter;
//
//   otapi.on("ping", callback);
//
//   return otapi.off.bind(otapi, "ping", callback);
// }

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
    await otapi.onAny(anyCallback);

    const ready = Promise.all(
      [
        async (): Promise<void> => {
          await otapi.once("simReadyForSimulation");
          console.info("OpenTrack is ready for simulation.");
        },
        async (): Promise<void> => {
          await otapi.once("simServerStarted");
          console.info("OpenTrack has started simulation server.");
        }
      ].map((func): Promise<void> => func())
    );

    console.info("Starting OpenTrack...");
    console.info([otBinaryPath, "-otd", "-scriptinit", "-runfile", otRunfile]);
    spawn(otBinaryPath, ["-otd", "-scriptinit", "-runfile", otRunfile]);

    console.info("Waiting for OpenTrack...");
    await ready;
    console.info("OpenTrack is ready.");

    const simulationEnd = otapi.once("simStopped");
    console.info("Starting simulation...");
    while (true) {
      try {
        await otapi.startSimulation();
        break;
      } catch (error) {
        console.warn(error);
        await new Promise((resolve): void => void setTimeout(resolve, 1000));
        console.info("Retrying to start the simulation...");
      }
    }

    await simulationEnd;
    console.info("Simulation ended.");
    console.info("Closing OpenTrack...");
    await otapi.terminateApplication();
    console.info("OpenTrack closed.");
  } catch (error) {
    console.error(error);
  } finally {
    await otapi.offAny(anyCallback);
    console.info("Finished.");
  }
})().catch((error): void => {
  console.error(error);
  process.exit(1);
});
