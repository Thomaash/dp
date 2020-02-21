import { DecisionModule } from "../";

export const decisionModule: DecisionModule = {
  name: "timetable-guess",
  newTrainEnteredOvertakingArea(
    { getTrainsDelayedArrivalAtStation, getTrainsInArea, planOvertaking },
    { overtakingArea, newTrain }
  ): void {
    console.log();

    const trainsOnItinerary = getTrainsInArea(overtakingArea);

    console.log(
      "New train " +
        newTrain.trainID +
        " in " +
        overtakingArea.overtakingAreaID +
        "."
    );
    console.log(
      "Considering:",
      trainsOnItinerary.map((value): string => value.train.trainID)
    );

    if (trainsOnItinerary.length < 2) {
      return;
    }

    const { next } = overtakingArea;
    if (next.size === 0) {
      return;
    } else if (next.size > 1) {
      console.error("TODO");
      return;
    }

    const nextStation = [...next][0].station;
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
