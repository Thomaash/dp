/* eslint-disable no-console */

import { join } from "path";
import { xor4096 } from "seedrandom";

import {
  GARunner,
  StatementFactory,
  createDivide,
  createInput,
  createIntegerConstant,
  createMinus,
  createPlus,
  createSimpleRunSaver,
  createSmallIntegerConstant,
  createTimes,
  leastSquaresFit,
} from "./dist";

type Inputs = { x: number };

const RANGE = 2 * 1;

const functionToApproximate = function ({ x }: { x: number }): number {
  return 4 * x ** 4 + x;
};

function addNoise(
  rng: seedrandom.prng,
  noise: number,
  validationResults: readonly number[]
): number[] {
  const amplitude = validationResults.reduce<number>(
    (amplitude, value): number => Math.max(amplitude, Math.abs(value)),
    0
  );
  return validationResults.map(
    (result): number =>
      result + noise * (rng.double() * 2 * amplitude - amplitude)
  );
}

for (const noise of [0, 0.05, 0.1, 0.2]) {
  console.group(`Noise ${noise}%`);

  const rng = xor4096("852");

  const inputData = new Array(100)
    .fill(null)
    .map((_v, i, { length }): Inputs => ({ x: (i / length - 0.5) * RANGE }))
    .sort(({ x: xA }, { x: xB }): number => xA - xB);
  const validationResults = inputData.map((inputs): number =>
    functionToApproximate(inputs)
  );
  const trainingResults = addNoise(rng, noise, validationResults);

  const runner = new GARunner<Inputs>(
    { x: Number },
    rng,
    leastSquaresFit(inputData, trainingResults),
    100,
    (inputs): readonly StatementFactory<Inputs>[] => [
      createDivide(inputs),
      createInput(inputs),
      createIntegerConstant(inputs),
      createMinus(inputs),
      createPlus(inputs),
      createSmallIntegerConstant(inputs),
      createTimes(inputs),
    ],
    createSimpleRunSaver(join("results", `${noise.toFixed(2)}-noise`), {
      data: inputData.map((inputs, i): [number, Inputs, number, number] => [
        i + 1,
        inputs,
        trainingResults[i],
        validationResults[i],
      ]),
      saveEveryRun: true,
      saveSummary: ["fit"],
      saveWinners: 1,
    }),
    leastSquaresFit(inputData, validationResults)
  );

  console.time("run");
  runner.run(500);
  console.timeEnd("run");

  console.groupEnd();
}
