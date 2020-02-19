import { DecisionModule } from "../";

export const decisionModule: DecisionModule = {
  name: "timetable-guess",
  newTrainEnteredOvertakingArea(
    { getTrainsDelayedArrivalAtStation, getTrainsOnItinerary, planOvertaking },
    { overtakingArea: { itinerary, next } }
  ): void {
    const trainsOnItinerary = getTrainsOnItinerary(itinerary);

    if (trainsOnItinerary.length < 2) {
      return;
    }

    if (next.length === 0) {
      return;
    } else if (next.length > 1) {
      console.error("TODO");
      return;
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
      planOvertaking(train2, train1).catch((error): void => {
        console.error("Can't plan overtaking:", error);
      });
    }
  }
};
