import { Infrastructure, Train } from "../infrastructure";
import { OTAPI } from "../otapi";
import { TrainTracker } from "../train-tracker";

import { DecisionModule, OvertakingArea } from "./api-public";
import { DecisionModuleAPIFactory, getOvertakingData } from "./api";
import { MapWithDefaultValueFactory } from "./util";
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

  const inOvertakingArea = new MapWithDefaultValueFactory<
    OvertakingArea,
    Set<Train>
  >((): Set<Train> => new Set());
  const trainOvertaking = new TrainOvertaking(infrastructure, otapi);
  const cleanupCallbacks: (() => void)[] = [];

  const tracker = new TrainTracker(otapi, infrastructure).startTracking(1);
  cleanupCallbacks.push(tracker.stopTraking.bind(tracker));

  const { overtakingAreas } = getOvertakingData(infrastructure);
  const decisionModuleAPIFactory = new DecisionModuleAPIFactory(
    infrastructure,
    tracker,
    trainOvertaking
  );

  async function setup(): Promise<void> {
    const removeListeners = await Promise.all([
      ...[...overtakingAreas.values()].map((overtakingArea): (() => void) =>
        tracker.on(
          "train-entered-itinerary",
          overtakingArea.itinerary,
          async ({ train, route, time }): Promise<void> => {
            inOvertakingArea.get(overtakingArea).add(train);

            try {
              await defaultModule.newTrainEnteredOvertakingArea(
                decisionModuleAPIFactory.get(overtakingArea),
                Object.freeze({
                  entryRoute: route,
                  newTrain: train,
                  overtakingArea,
                  time
                })
              );
            } catch (error) {
              console.error(
                "Overtaking decision module failed for train " +
                  train.trainID +
                  " which just entered " +
                  overtakingArea.itinerary.itineraryID +
                  " through " +
                  route.routeID +
                  ".",
                error
              );
            }
          }
        )
      ),
      ...[...overtakingAreas.values()].map((overtakingArea): (() => void) =>
        tracker.on(
          "train-left-itinerary",
          overtakingArea.itinerary,
          async ({ train }): Promise<void> => {
            try {
              await trainOvertaking.releaseTrains(overtakingArea, train);
            } catch (error) {
              console.error(
                "Failed to release trains blocked by " +
                  train.trainID +
                  " after overtaking in " +
                  overtakingArea.itinerary.itineraryID +
                  ".",
                error
              );
            }
          }
        )
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
