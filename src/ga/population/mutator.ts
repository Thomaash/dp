import { xor4096 } from "seedrandom";
import { Rng, Statement, isOperator } from "../language";

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

export class PopulationMutator {
  private readonly _rng: Rng;

  public constructor(public readonly seed: string) {
    this._rng = xor4096(seed);
  }

  public mutateSubtree(
    original: Statement,
    chance: number,
    generate: () => Statement
  ): Statement {
    if (this._rng() < chance) {
      return generate();
    } else if (isOperator(original)) {
      return original.create(
        original.createOperandtuple(
          (_value, i): Statement => {
            return this.mutateSubtree(original.operands[i], chance, generate);
          }
        )
      );
    } else {
      return original;
    }
  }
}
