/* eslint-disable no-console */

import { xor4096 } from "seedrandom";

import {
  PopulationCompetition,
  PopulationCrossover,
  PopulationGenerator,
  Statement,
  codeLengthPenalty,
  createSimplePopulationMutator,
  heightPenalty,
  statements,
  input,
  StatementFactory,
} from "../../../src/ga";

// TODO: This should be exproted from ga.
function regenerateDuplicates(
  population: readonly Statement[],
  generate: () => Statement
): Statement[] {
  const map = new Map<string, Statement>(
    population.map((statement): [string, Statement] => [
      statement.code,
      statement,
    ])
  );
  const unique = [...map.values()];
  while (unique.length < population.length) {
    unique.push(generate());
    console.count("regenerateDuplicates");
  }
  return unique;
}

describe.only("E2E scenario 1", function (): void {
  it("…", function (): void {
    const rng = xor4096("TEST");
    const numbers = new Array(1000)
      .fill(null)
      .map((): [number, number] => [rng.int32(), rng.int32()]);

    const generator = new PopulationGenerator("TEST", [
      ...statements,
      ...new Array(statements.length)
        .fill(null)
        .map((): StatementFactory => input),
    ]);
    const mutate = createSimplePopulationMutator(
      "TEST",
      0.5,
      generator.halfAndHalf.bind(generator, 12)
    );
    const competition = new PopulationCompetition(
      "TEST",
      (statement): number =>
        numbers.reduce<number>(
          (acc, [a, b]): number =>
            acc + Math.abs(Math.hypot(a, b) - statement.run(a, b)),
          0
        ) / numbers.length,
      codeLengthPenalty(),
      heightPenalty()
    );
    const crossover = new PopulationCrossover("TEST");

    let population = new Array(100)
      .fill(null)
      .map((): Statement => generator.halfAndHalf(12));

    function getSummary(): number[] {
      const ratings = [...competition.evaluateAll(population).values()]
        .map((value): number => value.combined)
        .sort((a, b): number => a - b);
      const noInfinityRatings = ratings.filter((combined): boolean =>
        Number.isFinite(combined)
      );

      return [
        population.length,
        Math.min(...ratings),
        noInfinityRatings.reduce<number>(
          (acc, combined): number => acc + combined,
          0
        ) / noInfinityRatings.length,
        Math.max(...ratings),
      ];
    }

    console.log(getSummary());

    for (let i = 0; i < 20; ++i) {
      const fitness = competition.evaluateAll(population);
      const sorted = competition.allVsAll(population, fitness);

      const nextGeneration = [];
      while (nextGeneration.length < sorted.length - 2) {
        nextGeneration.push(
          ...crossover.subtree(
            sorted.find(
              (_, i): boolean => i > rng.double() ** 2 * sorted.length
            ),
            sorted.find(
              (_, i): boolean => i > rng.double() ** 2 * sorted.length
            )
          )
        );
      }

      nextGeneration.map(mutate);

      population = regenerateDuplicates(
        [...sorted.slice(0, 2), ...nextGeneration],
        (): Statement => generator.halfAndHalf(12)
      );

      console.log(getSummary());
    }

    const sorted = competition.allVsAll(population);

    console.log("\n");
    console.log("==> Results:");
    console.log(
      sorted.map((statement): string => "\n" + statement.prettyCode).join("\n")
    );

    console.log("\n");
    console.log("==> Winner:");
    console.log(sorted[0].prettyCode);
  });
});
