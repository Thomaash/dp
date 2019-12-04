import { AnyEventCallback, OTAPI } from "./otapi";

const otapi = new OTAPI();

(async (): Promise<void> => {
  const anyCallback: AnyEventCallback = async function(
    name,
    payload
  ): Promise<void> {
    process.stdout.write(
      `\n\n===> OT: ${name}\n${JSON.stringify(payload, null, 4)}\n`
    );
  };

  try {
    await otapi.onAny(anyCallback);

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

    await otapi.startSimulation();
    await otapi.terminateApplication();
  } catch (error) {
    console.error(error);
  } finally {
    await otapi.onAny(anyCallback);
  }
})().catch((error): void => {
  console.error(error);
  process.exit(1);
});
