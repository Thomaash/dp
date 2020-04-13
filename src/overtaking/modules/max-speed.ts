import { DecisionModule } from "../";

export const decisionModule: DecisionModule = {
  name: "max-speed",
  newTrainEnteredOvertakingArea(
    { getTrainsInArea, log, planOvertaking },
    { overtakingArea }
  ): void {
    const trainsOnItinerary = getTrainsInArea(overtakingArea);

    if (trainsOnItinerary.length < 2) {
      return;
    }

    if (
      trainsOnItinerary[0].train.maxSpeed < trainsOnItinerary[1].train.maxSpeed
    ) {
      planOvertaking(
        trainsOnItinerary[1].train,
        trainsOnItinerary[0].train
      ).catch((error): void => {
        log.error(error, "Can't plan overtaking.");
      });
    }
  },
};
