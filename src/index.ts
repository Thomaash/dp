import { AnyEventCallback, OTAPI } from "./otapi";
import { spawn } from "child_process";

const otapi = new OTAPI();

const otBinaryPath =
  "/mnt/c/Program Files (x86)/OpenTrack V1.9/OpenTrack.app/OpenTrack.exe";

(async (): Promise<void> => {
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

    spawn(otBinaryPath, ["-otd"]);

    console.info("Waiting for OpenTrack...");
    await Promise.all(
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
    console.info("OpenTrack is ready.");

    const simulationEnd = otapi.once("simStopped");
    await otapi.startSimulation();
    await simulationEnd;
    await otapi.terminateApplication();
  } catch (error) {
    console.error(error);
  } finally {
    await otapi.offAny(anyCallback);
  }
})().catch((error): void => {
  console.error(error);
  process.exit(1);
});
