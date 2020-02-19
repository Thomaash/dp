import { Infrastructure, Train, Station } from "../../infrastructure";
import { TrainTracker } from "../../train-tracker";
import { DecisionModuleAPI } from "../api-public";

export function getDecisionModuleAPI(
  infrastructure: Infrastructure,
  tracker: TrainTracker
): DecisionModuleAPI {
  const api: DecisionModuleAPI = {
    getTrain(trainID): ReturnType<DecisionModuleAPI["getTrain"]> {
      const train = infrastructure.trains.get(trainID);
      if (train == null) {
        throw new Error(`There's no train called ${trainID}.`);
      }

      return train;
    },
    getTrainsDelayedArrivalAtStation(
      train,
      station
    ): ReturnType<DecisionModuleAPI["getTrainsDelayedArrivalAtStation"]> {
      const entry = train.timetable.entries.find(
        (entry): boolean => entry.station === station
      );

      if (entry == null) {
        throw new Error(
          `Train ${train.trainID} doesn't go through ${station.stationID}.`
        );
      }

      const plannedArrival =
        (entry.type === "pass"
          ? entry.arrival ?? entry.departure
          : entry.arrival) ?? Number.POSITIVE_INFINITY;

      const lastStation = tracker.getTrainsLastStation(train.trainID);
      const reserve = lastStation
        ? // If the train already passed some stations skip them.
          infrastructure.getTimetableReserve(
            train.timetable,
            lastStation,
            station
          ) ?? 0
        : train.timetable.entries.length
        ? // If the train didn't pass any stations but there are some use all.
          infrastructure.getTimetableReserve(
            train.timetable,
            train.timetable.entries[0].station,
            station
          ) ?? 0
        : // No stations no reserve.
          0;

      const delay = tracker.getDelay(train.trainID);

      const delayedArrival = plannedArrival + Math.max(0, delay - reserve);

      return delayedArrival;
    },
    getTrainsLastStation(
      train: Train
    ): ReturnType<DecisionModuleAPI["getTrainsLastStation"]> {
      return tracker.getTrainsLastStation(train.trainID);
    },
    getTrainsTimetableReserve(
      train: Train,
      fromStation: Station,
      toStation: Station,
      inclusive = false
    ): ReturnType<DecisionModuleAPI["getTrainsTimetableReserve"]> {
      const reserve = infrastructure.getTimetableReserve(
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
    getTrainsOnItinerary(
      itineraryInput
    ): ReturnType<DecisionModuleAPI["getTrainsOnItinerary"]> {
      const itinerary =
        typeof itineraryInput === "string"
          ? infrastructure.itineraries.get(itineraryInput)
          : itineraryInput;
      if (itinerary == null) {
        throw new Error(`There's no itinerary called ${itineraryInput}.`);
      }

      return tracker.getTrainsOnItineraryInOrder(itinerary);
    }
  };

  return Object.freeze(api);
}
