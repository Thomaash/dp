import { expect } from "chai";

import {
  bipolarConstant,
  minus,
  plus,
  smallIntegerConstant,
  Statement,
  isOperator
} from "../../../src/ga/language";
import { PopulationGenerator } from "../../../src/ga/population";
import { deepFreeze } from "../../../src/util/deep-freeze";

const getHeight = (statement: Statement): { min: number; max: number } => {
  if (isOperator(statement)) {
    return statement.operands.reduce(
      (
        acc,
        operand
      ): {
        min: number;
        max: number;
      } => {
        const val = getHeight(operand);
        return {
          min: Math.min(acc.min, val.min + 1),
          max: Math.max(acc.max, val.max + 1)
        };
      },
      { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
    );
  } else {
    return { min: 1, max: 1 };
  }
};

describe("Population", function(): void {
  describe("Generator", function(): void {
    const testOptions = deepFreeze([
      bipolarConstant,
      minus,
      plus,
      smallIntegerConstant
    ]);

    it("Statement Builders", function(): void {
      const generator = new PopulationGenerator("TEST", testOptions);

      for (let i = 0; i < 1000; ++i) {
        expect(
          generator.statementBuilder(),
          "The builder has to be selected from the supplied options."
        ).to.be.oneOf([bipolarConstant, minus, plus, smallIntegerConstant]);
      }
    });

    it("Terminal Builders", function(): void {
      const generator = new PopulationGenerator("TEST", testOptions);

      for (let i = 0; i < 1000; ++i) {
        expect(
          generator.terminalBuilder(),
          "The terminal builder has to be selected from the supplied options."
        ).to.be.oneOf([bipolarConstant, smallIntegerConstant]);
      }
    });

    it("Operator Builders", function(): void {
      const generator = new PopulationGenerator("TEST", testOptions);

      for (let i = 0; i < 1000; ++i) {
        expect(
          generator.operatorBuilder(),
          "The operator builder has to be selected from the supplied options."
        ).to.be.oneOf([minus, plus]);
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
            const { min, max } = getHeight(tree);

            expect(
              min,
              "All the leaves should be at the same height."
            ).to.equal(max);
            expect(min, "The tree should have requested height.").to.equal(
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
            const measured = getHeight(tree);

            expect(
              measured.min,
              "Min and max height should be withit the limits."
            ).to.be.at.least(min);
            expect(
              measured.max,
              "Min and max height should be withit the limits."
            ).to.be.at.least(min);
            expect(
              measured.min,
              "Min and max height should be withit the limits."
            ).to.be.at.most(max);
            expect(
              measured.max,
              "Min and max height should be withit the limits."
            ).to.be.at.most(max);
          }
        });
      });
    });
  });
});
