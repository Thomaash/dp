import { DecisionModule, Station } from "../";

import {
  getAllOvertakingCandidates,
  getConsecutivePairs,
  Bug,
} from "../../util";

// TODO: This should be configurable, not hardcoded.
const threshold = 15;

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
      log,
      planOvertaking,
    },
    { overtakingArea }
  ): void {
    const trainsInArea = getTrainsInArea(overtakingArea);

    if (trainsInArea.length <= 1) {
      return;
    }

    log.info();
    for (const [
      { train: train1 },
      { train: train2 },
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
      const difference = train1DelayedArrival - train2DelayedArrival;

      if (
        !Number.isFinite(train1DelayedArrival) ||
        !Number.isFinite(train2DelayedArrival)
      ) {
        log.error(new Bug("ETA of some train is not a finite number."));
      }

      if (difference > threshold) {
        log.info(
          `Overtake ${train1.trainID} by ${train2.trainID} at ${
            overtakingArea.outflowStation.stationID
          } (${formatSimulationTime(
            train1DelayedArrival
          )} vs ${formatSimulationTime(train2DelayedArrival)} at ${
            nextStation.stationID
          }).`
        );

        planOvertaking(train2, train1).catch((error): void => {
          log.error(error, "Can't plan overtaking.");
        });
      } else {
        log.info(
          `Don't overtake ${train1.trainID} by ${train2.trainID} at ${
            overtakingArea.outflowStation.stationID
          }, ${formatSimulationTime(
            train1DelayedArrival
          )} vs ${formatSimulationTime(train2DelayedArrival)} at ${
            nextStation.stationID
          }.`
        );

        cancelOvertaking(train2, train1).catch((error): void => {
          log.error(error, "Can't plan overtaking:");
        });
      }
    }
  },
};
