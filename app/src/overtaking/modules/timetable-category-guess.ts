import { DecisionModule, DecisionModuleFactory, Station } from "../";

import {
  Bug,
  getAllOvertakingCandidates,
  getConsecutivePairs,
} from "../../util";

export const decisionModuleFactory: DecisionModuleFactory = {
  name: "timetable-category-guess",
  create(params: {
    perCategoryThresholdBonus: Record<string, number>;
    stopPenalty: number;
    stopTime: boolean;
    threshold: number;
  }): DecisionModule {
    const {
      perCategoryThresholdBonus = {},
      stopPenalty = 0,
      stopTime = false,
      threshold: train2HasToArriveSoonerByAtLest = 60,
      ...paramsRest
    } = params;
    if (Object.keys(paramsRest).length !== 0) {
      throw new Error(
        `Superfluous parameters: ${Object.keys(paramsRest).join(", ")}.`
      );
    }

    return {
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

          const train1StopPenalty =
            train1.timetable.entries.find(
              (timetableEntry): boolean =>
                timetableEntry.station.stationID ===
                overtakingArea.outflowStation.stationID
            )?.type === "stop"
              ? stopPenalty
              : 0;
          const train2StopPenalty =
            train2.timetable.entries.find(
              (timetableEntry): boolean =>
                timetableEntry.station.stationID ===
                overtakingArea.outflowStation.stationID
            )?.type === "stop"
              ? stopPenalty
              : 0;

          const train1DelayedArrival = getTrainsDelayedArrivalAtStation(
            train1,
            nextStation,
            stopTime
          );
          const train2DelayedArrival = getTrainsDelayedArrivalAtStation(
            train2,
            nextStation,
            stopTime
          );

          const train1CategoryBonus =
            perCategoryThresholdBonus[train1.category] ?? 0;
          const train2CategoryBonus =
            perCategoryThresholdBonus[train2.category] ?? 0;

          const train1AdjustedDelayedArrival =
            train1DelayedArrival + train1StopPenalty + train1CategoryBonus;
          const train2AdjustedDelayedArrival =
            train2DelayedArrival + train2StopPenalty + train2CategoryBonus;

          const train2ArrivesSoonerBy =
            train1AdjustedDelayedArrival - train2AdjustedDelayedArrival;

          console.log(
            [
              "",
              " === DEBUG === ",
              "train1: " + train1.trainID,
              "train1DelayedArrival: " + train1DelayedArrival,
              "train1StopPenalty: " + train1StopPenalty,
              "train1CategoryBonus: " + train1CategoryBonus,
              "train2: " + train2.trainID,
              "train2DelayedArrival: " + train2DelayedArrival,
              "train2StopPenalty: " + train2StopPenalty,
              "train2CategoryBonus: " + train2CategoryBonus,
              "train2ArrivesSoonerBy: " + train2ArrivesSoonerBy,
              "train2HasToArriveSoonerByAtLest: " +
                train2HasToArriveSoonerByAtLest,
              "overtake: " +
                (train2ArrivesSoonerBy >= train2HasToArriveSoonerByAtLest),
              " === DEBUG === ",
              "",
            ].join("\n")
          );

          if (
            !Number.isFinite(train1AdjustedDelayedArrival) ||
            !Number.isFinite(train2AdjustedDelayedArrival)
          ) {
            log.error(new Bug("ETA of some train is not a finite number."));
          }

          if (train2ArrivesSoonerBy >= train2HasToArriveSoonerByAtLest) {
            log.info(
              `Overtake ${train1.trainID} by ${train2.trainID} at ${
                overtakingArea.outflowStation.stationID
              } (${formatSimulationTime(
                train1AdjustedDelayedArrival
              )} vs ${formatSimulationTime(train2AdjustedDelayedArrival)} at ${
                nextStation.stationID
              }).`
            );

            planOvertaking(train2, train1);
          } else {
            log.info(
              `Don't overtake ${train1.trainID} by ${train2.trainID} at ${
                overtakingArea.outflowStation.stationID
              }, ${formatSimulationTime(
                train1AdjustedDelayedArrival
              )} vs ${formatSimulationTime(train2AdjustedDelayedArrival)} at ${
                nextStation.stationID
              }.`
            );

            cancelOvertaking(train2, train1);
          }
        }
      },
    };
  },
};
