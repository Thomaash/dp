import { xor4096 } from "seedrandom";
import { Rng, Statement, isOperator } from "../language";

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
