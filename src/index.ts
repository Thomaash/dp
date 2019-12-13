import globby from "globby";
import { AnyEventCallback, OTAPI } from "./otapi";
import { release } from "os";
import { spawn } from "child_process";

const otapi = new OTAPI();

const otBinaryPath =
  "/mnt/c/Program Files (x86)/OpenTrack V1.9/OpenTrack.app/OpenTrack.exe";
const otWorksheetGlob =
  "/mnt/c/Users/st46664/Documents/Model/Worksheets/*.opentrack";

const isWSL =
  process.platform === "linux" &&
  release()
    .toUpperCase()
    .includes("MICROSOFT");

async function globWorksheetPaths(glob: string): Promise<string[]> {
  const worksheets = await globby(glob);
  return isWSL
    ? worksheets.map((path): string =>
        /^\/mnt\//.test(path)
          ? path
              .replace(
                /^\/mnt\/([^\/]+)\//,
                (_, letter: string): string => `${letter.toUpperCase()}:/`
              )
              .replace(/\//g, "\\")
          : path
      )
    : worksheets;
}

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
    const worksheetPaths = await globWorksheetPaths(otWorksheetGlob);
    spawn(otBinaryPath, ["-otd", ...worksheetPaths]);

    console.info("Waiting for OpenTrack...");
    await ready;
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
