import { Infrastructure, Train } from "../infrastructure";
import { OTAPI } from "../otapi";
import { TrainTracker } from "../train-tracker";

import { Blocking } from "./util";
import { OvertakingArea, DecisionModule } from "./api-public";
import { getDecisionModuleAPI, getOvertakingData } from "./api";

import { decisionModule as maxSpeedDM } from "./modules/max-speed";
import { decisionModule as timetableGuessDM } from "./modules/timetable-guess";

export interface OvertakingParams {
  defaultModule: string;
  infrastructure: Infrastructure;
  modules: DecisionModule[];
  otapi: OTAPI;
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
  const modules = [maxSpeedDM, timetableGuessDM, ...customModules];

  const requestedDefaultModule = modules.find(
    (module): boolean => module.name === defaultModuleName
  );
  if (requestedDefaultModule == null) {
    throw new Error(`There is no decision module named ${defaultModuleName}.`);
  }
  const defaultModule: DecisionModule = requestedDefaultModule;

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

    await Promise.all([
      otapi.setRouteDisallowed({
        trainID: waiting.trainID,
        routeID: exitRoute.routeID
      }),
      otapi.setStop({
        stationID: station.stationID,
        stopFlag: true,
        trainID: waiting.trainID
      }),
      otapi.setDepartureTime({
        stationID: station.stationID,
        time: Number.MAX_SAFE_INTEGER,
        trainID: waiting.trainID
      })
    ]);
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
            time:
              infrastructure.getTrainsDepartureFromStation(
                waiting,
                station.stationID
              ) ?? 0,
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
              .filter((oa): boolean => oa.exitRoute.routeID === routeID)
              .map((oa): Promise<void> => releaseTrains(oa, train))
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
