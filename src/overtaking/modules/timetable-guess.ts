import { DecisionModule, Station } from "../";

import { getAllOvertakingCandidates, getConsecutivePairs } from "../../util";

export const decisionModule: DecisionModule = {
  name: "timetable-guess",
  newTrainEnteredOvertakingArea(
    {
      cancelOvertaking,
      getCommonTimetableEntries,
      getOvertakingAreasByStations,
      getTrainsDelayedArrivalAtStation,
      getTrainsInArea,
      planOvertaking
    },
    { overtakingArea, newTrain }
  ): void {
    console.info();

    const trainsInArea = getTrainsInArea(overtakingArea);

    console.info(
      "New train " +
        newTrain.trainID +
        " in " +
        overtakingArea.overtakingAreaID +
        "."
    );
    console.info(
      "Trains:",
      trainsInArea.map((value): string => value.train.trainID)
    );

    if (trainsInArea.length <= 1) {
      console.info("Can't overtake with less than two trains.");
      console.info();

      return;
    }

    console.info();
    for (const [
      { train: train1 },
      { train: train2 }
    ] of getAllOvertakingCandidates(trainsInArea)) {
      console.info("Considering:", [train1.trainID, train2.trainID]);

      const commonTimetableEntries = getCommonTimetableEntries(
        overtakingArea.station,
        train1.timetable,
        train2.timetable
      );
      const commonStations = commonTimetableEntries.map(
        ([{ station }]): Station => station
      );
      const commonStationIDs = commonStations.map(
        (station): string => station.stationID
      );

      console.info(
        "Common stations:",
        commonStationIDs.slice(0, 1),
        "->",
        commonStationIDs.slice(1)
      );

      if (commonTimetableEntries.length <= 1) {
        console.info(
          "No common stations after the overtaking point. Don't overtake."
        );
        console.info();

        continue;
      }

      const nextStation =
        getConsecutivePairs(commonStations).find(
          ([inflowStation, overtakingStation]): boolean => {
            const nextOvertakingAreas = getOvertakingAreasByStations(
              inflowStation,
              overtakingStation
            );

            return !!nextOvertakingAreas.size;
          }
        )?.[1] ?? commonStations[commonStations.length - 1];

      console.info("Next overtaking station:", [nextStation.stationID]);

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
        console.info();

        planOvertaking(train2, train1).catch((error): void => {
          console.error("Can't plan overtaking:", error);
        });
      } else {
        console.info("Don't overtake.");
        console.info();

        cancelOvertaking(train2, train1).catch((error): void => {
          console.error("Can't plan overtaking:", error);
        });
      }
    }

    console.info();
  }
};
