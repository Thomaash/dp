import { DecisionModule } from "../";

export const decisionModule: DecisionModule = {
  name: "timetable-guess",
  newTrainEnteredOvertakingArea(
    { getTrainsDelayedArrivalAtStation, getTrainsOnItinerary, planOvertaking },
    { overtakingArea: { itinerary, next }, newTrain }
  ): void {
    console.log();

    const trainsOnItinerary = getTrainsOnItinerary(itinerary);

    console.log(
      "New train " + newTrain.trainID + " on " + itinerary.itineraryID + "."
    );
    console.log(
      "Considering:",
      trainsOnItinerary.map((value): string => value.train.trainID)
    );

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
      console.log("Overtake " + train1.trainID + " by " + train2.trainID + ".");
      planOvertaking(train2, train1).catch((error): void => {
        console.error("Can't plan overtaking:", error);
      });
    }

    console.log();
  }
};
