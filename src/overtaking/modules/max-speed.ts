import { DecisionModule, OvertakingDecision } from "../";

export const decisionModule: DecisionModule = {
  name: "max-speed",
  newTrainEnteredOvertakingArea(
    { getTrainsOnItinerary },
    { overtakingArea: { itinerary } }
  ): OvertakingDecision[] {
    const trainsOnItinerary = getTrainsOnItinerary(itinerary);

    if (trainsOnItinerary.length < 2) {
      return [];
    }

    if (
      trainsOnItinerary[0].train.maxSpeed < trainsOnItinerary[1].train.maxSpeed
    ) {
      return [
        {
          overtaking: trainsOnItinerary[1].train,
          waiting: trainsOnItinerary[0].train
        }
      ];
    }

    return [];
  }
};
