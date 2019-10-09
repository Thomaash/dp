console.log("Hello world!");

import { addOTListener } from "./open-track";
import { sendOTEndSimulation, sendOTStartSimulation } from "./open-track";

addOTListener((xml: string): void => {
  process.stdout.write(`\n\n===> OT\n${xml}\n`);
});

(async (): Promise<void> => {
  for (;;) {
    await new Promise((resolve): void => {
      setTimeout(resolve, 5 * 1000);
    });
    await sendOTStartSimulation();

    await new Promise((resolve): void => {
      setTimeout(resolve, 5 * 1000);
    });
    await sendOTEndSimulation();
  }
})();
