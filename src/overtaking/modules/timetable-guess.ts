import { DecisionModule, OvertakingDecision } from "../decision-module-api";

export const decisionModule: DecisionModule = {
  name: "timetable-guess",
  newTrainEnteredOvertakingArea(
    { getTrainsDelayedArrivalAtStation, getTrainsOnItinerary },
    { overtakingArea: { itinerary, next } }
  ): OvertakingDecision[] {
    const trainsOnItinerary = getTrainsOnItinerary(itinerary);

    if (trainsOnItinerary.length < 2) {
      return [];
    }

    if (next.length === 0) {
      return [];
    } else if (next.length > 1) {
      console.error("TODO");
      return [];
    }

    const nextStation = next[0].station;
    const [{ train: train1 }, { train: train2 }] = trainsOnItinerary;

    const train1DelayedArrival = getTrainsDelayedArrivalAtStation(
      train1,
      nextStation
    );
    const train2DelayedArrival = getTrainsDelayedArrivalAtStation(
      train2,
      nextStation
    );

    if (train1DelayedArrival > train2DelayedArrival) {
      return [
        {
          overtaking: train2,
          waiting: train1
        }
      ];
    }

    return [];
  }
};
