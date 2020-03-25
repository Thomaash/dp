import { Infrastructure, Train, Station } from "../../infrastructure";
import { TrainTracker } from "../../train-tracker";
import { DecisionModuleAPI, OvertakingArea } from "../api-public";
import { TrainOvertaking } from "../train-overtaking";
import { OvertakingData } from "./overtaking-data";
import { formatSimulationTime } from "../../otapi";
import { CallbackQueue } from "../../util";

export class DecisionModuleAPIFactory {
  private readonly _apiBase: Omit<
    DecisionModuleAPI,
    "planOvertaking" | "cancelOvertaking"
  >;

  public constructor(
    private readonly _infrastructure: Infrastructure,
    private readonly _overtakingData: OvertakingData,
    private readonly _tracker: TrainTracker,
    private readonly _trainOvertaking: TrainOvertaking
  ) {
    this._apiBase = {
      formatSimulationTime,

      getTrain: (trainID): ReturnType<DecisionModuleAPI["getTrain"]> => {
        const train = this._infrastructure.trains.get(trainID);
        if (train == null) {
          throw new Error(`There's no train called ${trainID}.`);
        }

        return train;
      },
      getTrainsDelayedArrivalAtStation: (
        train,
        station
      ): ReturnType<DecisionModuleAPI["getTrainsDelayedArrivalAtStation"]> => {
        const entry = train.timetable.entries.find(
          (entry): boolean => entry.station === station
        );

        if (entry == null) {
          throw new Error(
            `Train ${train.trainID} doesn't go through ${station.stationID}.`
          );
        }

        const plannedArrival =
          entry.arrival ?? entry.departure ?? Number.POSITIVE_INFINITY;

        const lastStation = this._tracker.getTrainsLastStation(train.trainID);
        const reserve = lastStation
          ? // If the train already passed some stations skip them.
            this._infrastructure.getTimetableReserve(
              train.timetable,
              lastStation,
              station
            ) ?? 0
          : train.timetable.entries.length
          ? // If the train didn't pass any stations but there are some use all.
            this._infrastructure.getTimetableReserve(
              train.timetable,
              train.timetable.entries[0].station,
              station
            ) ?? 0
          : // No stations no reserve.
            0;

        const delay = this._tracker.getDelay(train.trainID);

        const delayedArrival = plannedArrival + Math.max(0, delay - reserve);

        return delayedArrival;
      },
      getTrainsLastStation: (
        train: Train
      ): ReturnType<DecisionModuleAPI["getTrainsLastStation"]> => {
        return this._tracker.getTrainsLastStation(train.trainID);
      },
      getTrainsTimetableReserve: (
        train: Train,
        fromStation: Station,
        toStation: Station,
        inclusive = false
      ): ReturnType<DecisionModuleAPI["getTrainsTimetableReserve"]> => {
        const reserve = this._infrastructure.getTimetableReserve(
          train.timetable,
          fromStation,
          toStation,
          inclusive
        );

        if (reserve == null) {
          throw new Error(
            `Train ${train.trainID} doesn't go between ${toStation.stationID} and ${fromStation.stationID}.`
          );
        } else {
          return reserve;
        }
      },
      getCommonTimetableEntries: (
        fromStation,
        timetable1,
        timetable2
      ): ReturnType<DecisionModuleAPI["getCommonTimetableEntries"]> => {
        return this._infrastructure.getCommonTimetableEntries(
          fromStation,
          timetable1,
          timetable2
        );
      },
      getTrainsInArea: (
        area
      ): ReturnType<DecisionModuleAPI["getTrainsInArea"]> => {
        return this._tracker.getTrainsInAreaInOrder(area);
      },
      getOvertakingAreasByStation: (
        station
      ): ReturnType<DecisionModuleAPI["getOvertakingAreasByStation"]> => {
        return this._overtakingData.overtakingAreasByStation.get(station);
      },
      getOvertakingAreasByStations: (
        inflowStation,
        station
      ): ReturnType<DecisionModuleAPI["getOvertakingAreasByStations"]> => {
        return this._overtakingData.overtakingAreasByStations
          .get(inflowStation)
          .get(station);
      },
    };
    Object.freeze(this._apiBase);
  }

  public get(
    overtakingArea: OvertakingArea
  ): { api: DecisionModuleAPI; commit: () => Promise<void> } {
    const plannedOvertakings = new CallbackQueue();
    const canceledOvertakings = new CallbackQueue();

    return {
      api: Object.freeze<DecisionModuleAPI>({
        ...this._apiBase,
        planOvertaking: async (overtaking, waiting): Promise<void> => {
          plannedOvertakings.plan(
            (): Promise<void> =>
              this._trainOvertaking.planOvertaking(
                overtakingArea,
                overtaking,
                waiting
              )
          );
        },
        cancelOvertaking: async (overtaking, waiting): Promise<void> => {
          canceledOvertakings.plan(
            (): Promise<void> =>
              this._trainOvertaking.cancelOvertaking(
                overtakingArea,
                overtaking,
                waiting
              )
          );
        },
      }),
      commit: async (): Promise<void> => {
        await canceledOvertakings.executeParallel();
        await plannedOvertakings.executeParallel();
      },
    };
  }
}
