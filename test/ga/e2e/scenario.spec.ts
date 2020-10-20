/* eslint-disable no-console */

import { xor4096 } from "seedrandom";
import { ensureDirSync, readdirSync, writeFileSync } from "fs-extra";
import { join } from "path";

import { GARunner, RunSummary } from "../../../src/ga";

function createRunSaver(path: string): (runSummary: RunSummary) => void {
  ensureDirSync(path);
  if (readdirSync(path).length > 0) {
    throw new Error(`Target folder “${path}” isn't empty.`);
  }

  return (runSummary): void => {
    console.time("save");
    const runPath = join(path, "" + runSummary.number);
    ensureDirSync(runPath);

    runSummary.specimens.forEach(({ fit, specimen }, index): void => {
      writeFileSync(join(runPath, `${index + 1}.code.js`), specimen.prettyCode);
      writeFileSync(
        join(runPath, `${index + 1}.fit.json`),
        JSON.stringify(fit, null, 4)
      );
    });
    console.timeEnd("save");
  };
}

describe.skip("E2E scenario 1", function (): void {
  for (const noise of [0, 0.05, 0.1, 0.2]) {
    it(`Noise ${noise}%`, function (): void {
      const rng = xor4096("TEST");
      const numbers = new Array(10000)
        .fill(null)
        .map((): [number] => [(rng.double() - 0.5) * 2]);

      const runner = new GARunner<[number], number>(
        rng,
        numbers,
        ([x], actualResult): number => {
          const expectedResult =
            (x ** 2 + x) * (1 + (rng.double() - 0.5) * 2 * noise);
          return (expectedResult - actualResult) ** 2;
        },
        createRunSaver(join("ga-results", `${noise}-noise`))
      );

      for (let i = 0; i < 80; ++i) {
        console.time("run");
        runner.run();
        console.timeEnd("run");
        console.log("run:", runner.lastRun.number);
      }
    });
  }
});
