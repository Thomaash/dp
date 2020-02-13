import { Infrastructure, Route, Train } from "../infrastructure";
import { OTAPI } from "../otapi";
import { TrainTracker } from "../train-tracker";

import { Blocking } from "./util";
import {
  OvertakingArea,
  DecisionModuleAPI,
  DecisionModule
} from "./decision-module-api";
import { decisionModule as maxSpeedDecisionModule } from "./modules/max-speed";

export interface OvertakingParams {
  defaultModule: string;
  infrastructure: Infrastructure;
  modules: DecisionModule[];
  otapi: OTAPI;
}

function getOvertakingData(
  infrastructure: Infrastructure
): { overtakingAreas: OvertakingArea[]; overtakingRouteIDs: Set<string> } {
  const overtakingAreas = [...infrastructure.itineraries.values()]
    .filter(({ args }): boolean => args.overtaking)
    .filter(({ itineraryID, stations }): boolean => {
      if (stations.length) {
        return true;
      } else {
        throw new Error(
          `No station to faciliate overtaking was found in ${itineraryID}.`
        );
      }
    })
    .map(
      (itinerary): OvertakingArea => ({
        exitRoute: itinerary.routes[itinerary.routes.length - 1],
        itinerary,
        station: itinerary.stations[itinerary.stations.length - 1]
      })
    );

  const overtakingRouteIDs = overtakingAreas
    .flatMap(
      (overtakingArea): readonly Route[] => overtakingArea.itinerary.routes
    )
    .reduce<Set<string>>(
      (acc, route): Set<string> => acc.add(route.routeID),
      new Set()
    );

  return { overtakingAreas, overtakingRouteIDs };
}

function getDecisionModuleAPI(
  infrastructure: Infrastructure,
  tracker: TrainTracker
): DecisionModuleAPI {
  return Object.freeze({
    getTrain(trainID): ReturnType<DecisionModuleAPI["getTrain"]> {
      const train = infrastructure.trains.get(trainID);
      if (train == null) {
        throw new Error(`There's no train called ${trainID}.`);
      }

      return train;
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
  });
}

export function overtaking({
  defaultModule: defaultModuleName,
  infrastructure,
  modules: customModules,
  otapi
}: OvertakingParams): {
  setup: () => Promise<void>;
  cleanup: () => Promise<void>;
} {
  const modules = [maxSpeedDecisionModule, ...customModules];
  const defaultModule = modules.find(
    (module): boolean => module.name === defaultModuleName
  );
  if (defaultModule == null) {
    throw new Error(`There is no decision module named ${defaultModuleName}.`);
  }

  const blocking = new Blocking<Train>();
  const cleanupCallbacks: (() => void)[] = [];

  const tracker = new TrainTracker(otapi, infrastructure).startTracking(1);
  cleanupCallbacks.push(tracker.stopTraking.bind(tracker));

  const { overtakingAreas, overtakingRouteIDs } = getOvertakingData(
    infrastructure
  );
  const decisionModuleAPI = getDecisionModuleAPI(infrastructure, tracker);

  async function overtakeTrain(
    { exitRoute, station }: OvertakingArea,
    overtaking: Train,
    waiting: Train
  ): Promise<void> {
    blocking.block(station.stationID, overtaking.trainID, waiting);

    await otapi.setRouteDisallowed({
      trainID: waiting.trainID,
      routeID: exitRoute.routeID
    });
    await otapi.setStop({
      stationID: station.stationID,
      stopFlag: true,
      trainID: waiting.trainID
    });
    await otapi.setDepartureTime({
      stationID: station.stationID,
      time: Number.MAX_SAFE_INTEGER,
      trainID: waiting.trainID
    });
  }

  async function releaseTrains(
    { exitRoute, station }: OvertakingArea,
    overtaking: Train
  ): Promise<void> {
    const blockedByMe = blocking.getBlocked(
      station.stationID,
      overtaking.trainID
    );
    blocking.unblockAll(station.stationID, overtaking.trainID);

    await Promise.all(
      blockedByMe
        .filter((train): boolean => !blocking.isBlocked(train))
        .flatMap((waiting): Promise<void>[] => [
          // Unblock exit route.
          otapi.setRouteAllowed({
            routeID: exitRoute.routeID,
            trainID: waiting.trainID
          }),
          // Restore departure time.
          otapi.setDepartureTime({
            stationID: station.stationID,
            time: 0, // TODO: The original time from the timetable should be used.
            trainID: waiting.trainID
          })
        ])
    );
  }

  async function setup(): Promise<void> {
    const removeListeners = await Promise.all([
      otapi.on(
        "routeEntry",
        async (_, { routeID, time, trainID }): Promise<void> => {
          const train = infrastructure.trains.get(trainID);
          if (train == null) {
            throw new Error(`No train called ${trainID}.`);
          }

          if (overtakingRouteIDs.has(routeID)) {
            const route = infrastructure.routes.get(routeID);
            if (route == null) {
              throw new Error(`No route called ${routeID}.`);
            }

            await Promise.all(
              overtakingAreas
                .filter(({ itinerary: { routes } }): boolean =>
                  routes.includes(route)
                )
                .map(
                  async (overtakingArea): Promise<void> => {
                    const decisions = await defaultModule.newTrainEnteredOvertakingArea(
                      decisionModuleAPI,
                      Object.freeze({
                        entryRoute: route,
                        newTrain: train,
                        overtakingArea,
                        time
                      })
                    );

                    await Promise.all(
                      decisions.map(
                        (decision): Promise<void> =>
                          overtakeTrain(
                            overtakingArea,
                            decision.overtaking,
                            decision.waiting
                          )
                      )
                    );
                  }
                )
            );
          }
        }
      ),
      otapi.on(
        "routeExit",
        async (_, { routeID, trainID }): Promise<void> => {
          const train = infrastructure.trains.get(trainID);
          if (train == null) {
            throw new Error(`No train called ${trainID}.`);
          }

          await Promise.all(
            overtakingAreas
              .filter((oi): boolean => oi.exitRoute.routeID === routeID)
              .map((oi): Promise<void> => releaseTrains(oi, train))
          );
        }
      ),
      otapi.on(
        "trainCreated",
        async (_, { trainID }): Promise<void> => {
          const train = infrastructure.trains.get(trainID);
          if (train == null) {
            throw new Error(`No train called ${trainID}.`);
          }

          await Promise.all(
            [...train.routes.values()].map(
              ({ routeID }): Promise<void> =>
                otapi.setRouteAllowed({ routeID, trainID })
            )
          );
        }
      )
    ]);
    cleanupCallbacks.push(...removeListeners);
  }

  async function cleanup(): Promise<void> {
    cleanupCallbacks.splice(0).forEach((callback): void => void callback());
  }

  return { setup, cleanup };
}
