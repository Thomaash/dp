import { Infrastructure } from "../infrastructure";
import { OTAPI } from "../otapi";
import { TrainTracker } from "../train-tracker";

import { DecisionModule } from "./api-public";
import { DecisionModuleAPIFactory, getOvertakingData } from "./api";
import { TrainOvertaking } from "./train-overtaking";

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

  const trainOvertaking = new TrainOvertaking(infrastructure, otapi);
  const cleanupCallbacks: (() => void)[] = [];

  const tracker = new TrainTracker(otapi, infrastructure).startTracking(1);
  cleanupCallbacks.push(tracker.stopTraking.bind(tracker));

  const { overtakingAreas, overtakingRouteIDs } = getOvertakingData(
    infrastructure
  );
  const decisionModuleAPIFactory = new DecisionModuleAPIFactory(
    infrastructure,
    tracker,
    trainOvertaking
  );

  async function setup(): Promise<void> {
    const removeListeners = await Promise.all([
      otapi.on(
        "routeEntry",
        async (_, { routeID, time, trainID }): Promise<void> => {
          const train = infrastructure.trains.get(trainID);
          if (train == null) {
            throw new Error(`No train called ${trainID}.`);
          }

          if (!overtakingRouteIDs.has(routeID)) {
            return;
          }

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
                    decisionModuleAPIFactory.get(overtakingArea),
                    Object.freeze({
                      entryRoute: route,
                      newTrain: train,
                      overtakingArea,
                      time
                    })
                  );

                  if (decisions) {
                    await Promise.all(
                      decisions.map(
                        (decision): Promise<void> =>
                          trainOvertaking.planOvertaking(
                            overtakingArea,
                            decision.overtaking,
                            decision.waiting
                          )
                      )
                    );
                  }
                }
              )
          );
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
              .map(
                (oa): Promise<void> => trainOvertaking.releaseTrains(oa, train)
              )
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
    cleanupCallbacks
      .splice(0)
      .reverse()
      .forEach((callback): void => void callback());
  }

  return { setup, cleanup };
}
