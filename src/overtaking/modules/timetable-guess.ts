import { DecisionModule, Station } from "../";

import { getAllOvertakingCandidates, getConsecutivePairs } from "../../util";

export const decisionModule: DecisionModule = {
  name: "timetable-guess",
  newTrainEnteredOvertakingArea(
    {
      cancelOvertaking,
      formatSimulationTime,
      getCommonTimetableEntries,
      getOvertakingAreasByStations,
      getTrainsDelayedArrivalAtStation,
      getTrainsInArea,
      planOvertaking
    },
    { overtakingArea }
  ): void {
    const trainsInArea = getTrainsInArea(overtakingArea);

    if (trainsInArea.length <= 1) {
      return;
    }

    console.info();
    for (const [
      { train: train1 },
      { train: train2 }
    ] of getAllOvertakingCandidates(trainsInArea)) {
      const commonTimetableEntries = getCommonTimetableEntries(
        overtakingArea.outflowStation,
        train1.timetable,
        train2.timetable
      );
      const commonStations = commonTimetableEntries.map(
        ([{ station }]): Station => station
      );

      if (commonTimetableEntries.length <= 1) {
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

      const train1DelayedArrival = getTrainsDelayedArrivalAtStation(
        train1,
        nextStation
      );
      const train2DelayedArrival = getTrainsDelayedArrivalAtStation(
        train2,
        nextStation
      );

      if (
        !Number.isFinite(train1DelayedArrival) ||
        !Number.isFinite(train2DelayedArrival)
      ) {
        console.error(
          "Some ETA is not a finite number, " +
            "this is a bug as this should never happen."
        );
      }

      if (train1DelayedArrival > train2DelayedArrival) {
        console.info(
          `Overtake ${train1.trainID} by ${train2.trainID} at ${
            overtakingArea.outflowStation.stationID
          } (${formatSimulationTime(
            train1DelayedArrival
          )} vs ${formatSimulationTime(train2DelayedArrival)} at ${
            nextStation.stationID
          }).`
        );

        planOvertaking(train2, train1).catch((error): void => {
          console.error("Can't plan overtaking:", error);
        });
      } else {
        console.info(
          `Don't overtake ${train1.trainID} by ${train2.trainID} at ${
            overtakingArea.outflowStation.stationID
          }, ${formatSimulationTime(
            train1DelayedArrival
          )} vs ${formatSimulationTime(train2DelayedArrival)} at ${
            nextStation.stationID
          }.`
        );

        cancelOvertaking(train2, train1).catch((error): void => {
          console.error("Can't plan overtaking:", error);
        });
      }
    }
  }
};
