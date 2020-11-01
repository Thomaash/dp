/* eslint-disable no-console */

import { xor4096 } from "seedrandom";
import { ensureDirSync, readdirSync, writeFileSync } from "fs-extra";
import { join } from "path";

import { GARunner, InputConfig, RunSummary } from "../../../src/ga";

type Inputs = { x: number };

function createRunSaver<Inputs extends InputConfig>(
  path: string,
  data?: readonly [number, Inputs, unknown][]
): (runSummary: RunSummary<Inputs>) => void {
  ensureDirSync(path);
  if (readdirSync(path).length > 0) {
    throw new Error(`Target folder “${path}” isn't empty.`);
  }

  if (Array.isArray(data) && data.length > 0) {
    const keys: readonly (keyof Inputs)[] = Object.keys(data[0][1]).sort();
    writeFileSync(
      join(path, "data.csv"),
      [
        ["", ...keys, "return"],
        ...data.map(([nm, inputs, value]): unknown[] => [
          nm,
          ...keys.map((key): unknown => inputs[key]),
          value,
        ]),
      ]
        .map((row): string => row.join("\t"))
        .join("\n")
    );
  }

  return (runSummary): void => {
    console.time("save");
    const runPath = join(path, "" + runSummary.number);
    ensureDirSync(runPath);

    runSummary.specimens.forEach(({ fit, specimen }, index): void => {
      writeFileSync(
        join(runPath, `${index + 1}.code.js`),
        specimen.prettyFunction
      );
      writeFileSync(
        join(runPath, `${index + 1}.fit.json`),
        JSON.stringify(fit, null, 4)
      );
    });
    console.timeEnd("save");
  };
}

const RANGE = 2 * 1;

describe.skip("E2E scenario 1", function (): void {
  for (const [fName, f] of [
    [
      "xe4px",
      function ({ x }: { x: number }): number {
        return x ** 4 + x;
      },
    ],
    [
      "xe3px",
      function ({ x }: { x: number }): number {
        return x ** 3 + x;
      },
    ],
    [
      "xe2px",
      function ({ x }: { x: number }): number {
        return x ** 2 + x;
      },
    ],
  ] as const) {
    describe(fName, function (): void {
      for (const noise of [0, 0.05, 0.1, 0.2]) {
        it(`Noise ${noise}%`, function (): void {
          const rng = xor4096("TEST");
          const inputs = new Array(10000)
            .fill(null)
            .map((): Inputs => ({ x: (rng.double() - 0.5) * RANGE }))
            .sort(({ x: xA }, { x: xB }): number => xA - xB);

          const runner = new GARunner<Inputs, number>(
            { x: Number },
            rng,
            inputs,
            ({ x }, actualResult): number => {
              const expectedResult =
                f({ x }) * (1 + (rng.double() - 0.5) * 2 * noise);
              return (expectedResult - actualResult) ** 2;
            },
            createRunSaver(
              join(`ga-results-${fName}`, `${noise}-noise`),
              inputs.map((inputs, i): [number, Inputs, number] => [
                i + 1,
                inputs,
                f(inputs) * (1 + (rng.double() - 0.5) * 2 * noise),
              ])
            )
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
  }
});
