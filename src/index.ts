import { OTAPI } from "./open-track";

const otapi = new OTAPI();

(async (): Promise<void> => {
  otapi.addListener(
    async ({ name, xml }): Promise<void> => {
      process.stdout.write(
        `\n\n===> OT: ${name}\n${JSON.stringify(xml, null, 4)}\n`
      );
    }
  );

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

  try {
    await otapi.startSimulation();
  } catch (error) {
    console.error(error);
  }
})().catch((error): void => {
  console.error(error);
  process.exit(1);
});
