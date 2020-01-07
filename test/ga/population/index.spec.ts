import { expect } from "chai";

import {
  Statement,
  bipolarConstant,
  floor,
  integerConstant,
  isOperator,
  minus,
  not,
  plus,
  smallIntegerConstant,
  ifElse
} from "../../../src/ga/language";
import {
  PopulationGenerator,
  PopulationMutator
} from "../../../src/ga/population";
import { deepFreeze } from "../../../src/util/deep-freeze";
import { createRng, testCommon } from "../util";

const create = (
  seed: number = 0
): Record<
  "c1" | "c2" | "c3" | "c4" | "c5" | "p1c1c2" | "p2c3c4" | "m1p1p2",
  Statement
> => {
  const rng = createRng(seed);

  const c1 = integerConstant.create(rng);
  const c2 = integerConstant.create(rng);
  const c3 = integerConstant.create(rng);
  const c4 = integerConstant.create(rng);
  const c5 = integerConstant.create(rng);

  const p1c1c2 = plus.create([c1, c2]);
  const p2c3c4 = plus.create([c3, c4]);

  const m1p1p2 = minus.create([p1c1c2, p2c3c4]);

  return { c1, c2, c3, c4, c5, p1c1c2, p2c3c4, m1p1p2 };
};

describe("Population", function(): void {
  describe("Generator", function(): void {
    const testOptions = deepFreeze([
      bipolarConstant,
      minus,
      plus,
      smallIntegerConstant
    ]);

    it("Statement Factories", function(): void {
      const generator = new PopulationGenerator("TEST", testOptions);

      for (let i = 0; i < 1000; ++i) {
        expect(
          generator.statementFactory(),
          "The factory has to be selected from the supplied options"
        ).to.be.oneOf([bipolarConstant, minus, plus, smallIntegerConstant]);
      }
    });

    it("Terminal Factories", function(): void {
      const generator = new PopulationGenerator("TEST", testOptions);

      for (let i = 0; i < 1000; ++i) {
        expect(
          generator.terminalFactory(),
          "The terminal factory has to be selected from the supplied options"
        ).to.be.oneOf([bipolarConstant, smallIntegerConstant]);
      }
    });

    it("Operator Factories", function(): void {
      const generator = new PopulationGenerator("TEST", testOptions);

      for (let i = 0; i < 1000; ++i) {
        expect(
          generator.operatorFactory(),
          "The operator factory has to be selected from the supplied options"
        ).to.be.oneOf([minus, plus]);
      }
    });

    describe("Fixed number of args operator Factories", function(): void {
      const population = deepFreeze([
        bipolarConstant,
        floor,
        ifElse,
        minus,
        not,
        plus,
        smallIntegerConstant
      ]);

      for (const { args, operators } of [
        { args: 1, operators: [floor, not] },
        { args: 2, operators: [minus, plus] },
        { args: 3, operators: [ifElse] }
      ] as const) {
        it(`Arguments: ${args}`, function(): void {
          const generator = new PopulationGenerator("TEST", population);

          for (let i = 0; i < 1000; ++i) {
            expect(
              generator.fixedArgsOperatorFactory(args),
              "The operator factory has to be selected from the supplied options"
            ).to.be.oneOf(operators);
          }
        });
      }
    });

    describe("Full", function(): void {
      [1, 2, 3, 7, 10].forEach((height): void => {
        it(`Height: ${height}`, function(): void {
          this.timeout(50000);

          const generator = new PopulationGenerator(
            `TEST${height}`,
            testOptions
          );

          for (let i = 0; i < 3; ++i) {
            const tree = generator.full(height);
            const { heightMin, heightMax } = tree;

            expect(
              heightMin,
              "All the leaves should be at the same height"
            ).to.equal(heightMax);
            expect(heightMin, "The tree should have requested height").to.equal(
              height
            );
          }
        });
      });
    });

    describe("Grow", function(): void {
      [
        [1, 1],
        [1, 7],
        [3, 9]
      ].forEach(([min, max]): void => {
        it(`Height: ${min}-${max}`, function(): void {
          this.timeout(10000);

          const generator = new PopulationGenerator(
            `TEST${min}-${max}`,
            testOptions
          );

          for (let i = 0; i < 3; ++i) {
            const tree = generator.grow(min, max);
            const measured = tree;

            expect(
              measured.heightMin,
              "Min and max height should be withit the limits"
            ).to.be.at.least(min);
            expect(
              measured.heightMax,
              "Min and max height should be withit the limits"
            ).to.be.at.least(min);
            expect(
              measured.heightMin,
              "Min and max height should be withit the limits"
            ).to.be.at.most(max);
            expect(
              measured.heightMax,
              "Min and max height should be withit the limits"
            ).to.be.at.most(max);
          }
        });
      });
    });
  });

  describe("Mutator", function(): void {
    describe("Subtree", function(): void {
      for (const chance of [0, 0.1, 1]) {
        it(`Chance ${chance}`, function(): void {
          this.timeout(4000);

          const { c5, m1p1p2 } = create();
          const mutator = new PopulationMutator("TEST");

          const original = m1p1p2;
          testCommon(2, "1 + 2 - (3 + 4)", original);

          for (let i = 0; i < 50; ++i) {
            const mutant = mutator.mutateSubtree(
              original,
              chance,
              (): Statement => c5
            );

            expect(
              mutant,
              "The mutant should not be the same instance as the original"
            ).to.not.equal(original);
            testCommon(mutant.args, null, mutant);

            if (chance === 0) {
              expect(
                mutant.prettyCode,
                "If the probability of mutation is zero there should never be any change made"
              ).to.equal(original.prettyCode);
            } else if (chance === 1) {
              expect(
                mutant.prettyCode,
                // Note that the chance is only zero thanks to the seed used above.
                // Changes to the way random numbers are generated may require the
                // seed to be changed as the same code may be randomly generated
                // more than once.
                "If the probability of mutation is one there should always be a change made"
              ).to.not.equal(original.prettyCode);
            }

            if (mutant.prettyCode !== original.prettyCode) {
              expect(
                mutant.prettyCode,
                "The supplied generator always returns the terminal 5 so the code should either be unchanged or containt at least one terminal 5"
              ).to.match(/\b5\b/g);
            }
          }
        });
      }
    });
  });
});
