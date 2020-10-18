/* eslint-disable no-console */

import { xor4096 } from "seedrandom";

import {
  PopulationCompetition,
  PopulationCrossover,
  PopulationGenerator,
  Statement,
  StatementFactory,
  codeLengthPenalty,
  createSimplePopulationMutator,
  heightPenalty,
  input,
  statements,
} from "../../../src/ga";

// TODO: This should be exported from GA.
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
    // console.count("regenerateDuplicates");
  }
  return unique;
}

describe.skip("E2E scenario 1", function (): void {
  for (const noise of [0, 0.05, 0.1, 0.2]) {
    it(`Noise ${noise}%`, function (): void {
      const rng = xor4096("TEST");
      const numbers = new Array(10000).fill(null).map((): [
        [number],
        number
      ] => {
        const x = (rng.double() - 0.5) * 2000;
        const result = (x ** 2 + x) * (1 + (rng.double() - 0.5) * 2 * noise);

        return [[x], result];
      });

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
            (acc, [[a], result]): number =>
              acc + Math.abs(result - statement.run(a)),
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

      // console.log(getSummary());

      for (let i = 0; i < 80; ++i) {
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

        // console.log(getSummary());
      }

      const sorted = competition.allVsAll(population);

      // console.log("\n");
      // console.log("==> Results:");
      // console.log(
      //   sorted
      //     .map((statement): string => "\n" + statement.prettyCode)
      //     .join("\n")
      // );

      console.log("\n");
      console.log("==> Bronze:");
      console.log(sorted[2].prettyCode);
      console.log("\n");
      console.log(
        `==> Fitness: ${JSON.stringify(
          competition.evaluateOne(sorted[2]),
          null,
          4
        )}`
      );

      console.log("\n");
      console.log("==> Silver:");
      console.log(sorted[1].prettyCode);
      console.log("\n");
      console.log(
        `==> Fitness: ${JSON.stringify(
          competition.evaluateOne(sorted[1]),
          null,
          4
        )}`
      );

      console.log("\n");
      console.log("==> Gold:");
      console.log(sorted[0].prettyCode);
      console.log("\n");
      console.log(
        `==> Fitness: ${JSON.stringify(
          competition.evaluateOne(sorted[0]),
          null,
          4
        )}`
      );
    });
  }
});
