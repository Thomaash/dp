import { xor4096 } from "seedrandom";
import { Statement, isOperator } from "../language";

export type MutateSpecimen = (original: Statement) => Statement;

export type MutateSpecimenFactory = (
  seed: string,
  chance: number,
  generate: () => Statement
) => MutateSpecimen;

export function createSimplePopulationMutator(
  seed: string,
  chance: number,
  generate: () => Statement
): MutateSpecimen {
  const rng = xor4096(seed);

  return function simplePopulationMutate(original: Statement): Statement {
    if (rng() < chance) {
      return generate();
    } else if (isOperator(original)) {
      return original.create(
        original.createOperandtuple(
          (_value, i): Statement => {
            return simplePopulationMutate(original.operands[i]);
          }
        )
      );
    } else {
      return original;
    }
  };
}
