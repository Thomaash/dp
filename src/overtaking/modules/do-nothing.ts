import { DecisionModule } from "../";

export const decisionModule: DecisionModule = {
  name: "do-nothing",
  newTrainEnteredOvertakingArea(): void {},
};
