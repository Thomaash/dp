import { xor4096 } from "seedrandom";
import { InputConfig, Statement, isOperator } from "../language";

export type MutateSpecimen<Inputs extends InputConfig> = (
  original: Statement<Inputs>
) => Statement<Inputs>;

export type MutateSpecimenFactory<Inputs extends InputConfig> = (
  seed: string,
  chance: number,
  generate: () => Statement<Inputs>
) => MutateSpecimen<Inputs>;

export function createSubtreePopulationMutator<Inputs extends InputConfig>(
  seed: string,
  chance: number,
  generate: () => Statement<Inputs>
): MutateSpecimen<Inputs> {
  const rng = xor4096(seed);

  return function simplePopulationMutate(
    original: Statement<Inputs>
  ): Statement<Inputs> {
    if (rng() < chance) {
      return generate();
    } else if (isOperator(original)) {
      return original.create(
        original.createOperandtuple(
          (_value, i): Statement<Inputs> => {
            return simplePopulationMutate(original.operands[i]);
          }
        )
      );
    } else {
      return original;
    }
  };
}
