import { DecisionModule } from "../";

import { getConsecutivePairs } from "../../util";

export const decisionModule: DecisionModule = {
  name: "timetable-guess",
  newTrainEnteredOvertakingArea(
    {
      cancelOvertaking,
      getTrainsDelayedArrivalAtStation,
      getTrainsInArea,
      planOvertaking
    },
    { overtakingArea, newTrain }
  ): void {
    console.info();

    const trainsOnItinerary = getTrainsInArea(overtakingArea);

    console.info(
      "New train " +
        newTrain.trainID +
        " in " +
        overtakingArea.overtakingAreaID +
        "."
    );
    console.info(
      "Trains:",
      trainsOnItinerary.map((value): string => value.train.trainID)
    );

    const { next } = overtakingArea;
    if (next.size === 0) {
      return;
    } else if (next.size > 1) {
      console.error("TODO");
      return;
    }

    const nextStation = [...next][0].station;

    for (const [{ train: train1 }, { train: train2 }] of getConsecutivePairs(
      trainsOnItinerary
    )) {
      console.info("Considering:", [train1.trainID, train2.trainID]);

      const train1DelayedArrival = getTrainsDelayedArrivalAtStation(
        train1,
        nextStation
      );
      const train2DelayedArrival = getTrainsDelayedArrivalAtStation(
        train2,
        nextStation
      );

      if (train1DelayedArrival > train2DelayedArrival) {
        console.info(
          "Overtake " + train1.trainID + " by " + train2.trainID + "."
        );
        planOvertaking(train2, train1).catch((error): void => {
          console.error("Can't plan overtaking:", error);
        });
      } else {
        console.info("Don't overtake.");
        cancelOvertaking(train2, train1).catch((error): void => {
          console.error("Can't plan overtaking:", error);
        });
      }
    }

    console.info();
  }
};
