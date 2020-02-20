import { DecisionModule } from "../";

export const decisionModule: DecisionModule = {
  name: "max-speed",
  newTrainEnteredOvertakingArea(
    { getTrainsOnItinerary, planOvertaking },
    { overtakingArea: { itinerary } }
  ): void {
    const trainsOnItinerary = getTrainsOnItinerary(itinerary);

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
        console.error("Can't plan overtaking:", error);
      });
    }
  }
};
