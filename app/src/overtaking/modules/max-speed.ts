import { DecisionModule, DecisionModuleFactory } from "../";

export const decisionModuleFactory: DecisionModuleFactory = {
  name: "max-speed",
  create(params: {}): DecisionModule {
    if (Object.keys(params).length !== 0) {
      throw new Error(
        `Superfluous parameters: ${Object.keys(params).join(", ")}.`
      );
    }

    return {
      name: "max-speed",
      newTrainEnteredOvertakingArea(
        { getTrainsInArea, planOvertaking },
        { overtakingArea }
      ): void {
        const trainsOnItinerary = getTrainsInArea(overtakingArea);

        if (trainsOnItinerary.length < 2) {
          return;
        }

        if (
          trainsOnItinerary[0].train.maxSpeed <
          trainsOnItinerary[1].train.maxSpeed
        ) {
          planOvertaking(
            trainsOnItinerary[1].train,
            trainsOnItinerary[0].train
          );
        }
      },
    };
  },
};
