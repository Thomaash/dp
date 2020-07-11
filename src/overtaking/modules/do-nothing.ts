import { DecisionModule, DecisionModuleFactory } from "../";

export const decisionModuleFactory: DecisionModuleFactory = {
  name: "do-nothing",
  create(): DecisionModule {
    return {
      name: "do-nothing",
      newTrainEnteredOvertakingArea(): void {},
    };
  },
};
