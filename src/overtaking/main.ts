import { Infrastructure } from "../infrastructure";
import { OTAPI } from "../otapi";
import { TrainTracker } from "../train-tracker";
import { CurryLog } from "../curry-log";

import { DecisionModule } from "./api-public";
import { DecisionModuleAPIFactory, getOvertakingData } from "./api";
import { TrainOvertaking } from "./train-overtaking";

import { decisionModule as doNothingDM } from "./modules/do-nothing";
import { decisionModule as maxSpeedDM } from "./modules/max-speed";
import { decisionModule as timetableGuessDM } from "./modules/timetable-guess";

export interface OvertakingParams {
  defaultModule: string;
  infrastructure: Infrastructure;
  log: CurryLog;
  modules: DecisionModule[];
  otapi: OTAPI;
}

export function overtaking({
  defaultModule: defaultModuleName,
  infrastructure,
  log,
  modules: customModules,
  otapi,
}: OvertakingParams): {
  setup: () => Promise<void>;
  cleanup: () => Promise<void>;
} {
  const cleanupCallbacks: (() => void)[] = [];

  const modules = [doNothingDM, maxSpeedDM, timetableGuessDM, ...customModules];

  const requestedDefaultModule = modules.find(
    (module): boolean => module.name === defaultModuleName
  );
  if (requestedDefaultModule == null) {
    throw new Error(`There is no decision module named ${defaultModuleName}.`);
  }
  const defaultModule: DecisionModule = requestedDefaultModule;
  log.info(`Default overtaking module: ${defaultModule.name}.`);

  const overtakingData = getOvertakingData(infrastructure);
  const { overtakingAreas } = overtakingData;

  const tracker = new TrainTracker(
    log("train-tracker"),
    otapi,
    infrastructure,
    overtakingAreas
  ).startTracking(1);
  cleanupCallbacks.push(tracker.stopTraking.bind(tracker));

  const trainOvertaking = new TrainOvertaking(
    log("train-overtaking"),
    infrastructure,
    otapi,
    tracker
  );

  const decisionModuleAPIFactory = new DecisionModuleAPIFactory(
    infrastructure,
    overtakingData,
    tracker,
    trainOvertaking,
    log("api")
  );

  async function setup(): Promise<void> {
    const removeListeners = await Promise.all([
      ...[...overtakingAreas.values()].flatMap(
        (overtakingArea): (() => void)[] => [
          tracker.onArea(
            "train-entered-area",
            overtakingArea,
            async ({ train, route, time }): Promise<void> => {
              try {
                const { api, commit } = decisionModuleAPIFactory.get(
                  overtakingArea
                );
                await defaultModule.newTrainEnteredOvertakingArea(
                  api,
                  Object.freeze({
                    entryRoute: route,
                    newTrain: train,
                    overtakingArea,
                    time,
                  })
                );
                await commit();
              } catch (error) {
                log.error(
                  error,
                  "Overtaking decision module failed for train " +
                    train.trainID +
                    " which just entered " +
                    overtakingArea.overtakingAreaID +
                    " through " +
                    route.routeID +
                    ".",
                  error
                );
              }
            }
          ),
          tracker.onArea(
            "train-left-area",
            overtakingArea,
            async ({ train, time }): Promise<void> => {
              try {
                log.log(
                  "--A-- Release trains blocked by " +
                    train.trainID +
                    `(${time}).`
                );
                await trainOvertaking.releaseTrains(overtakingArea, train);
              } catch (error) {
                log.error(
                  error,
                  "Failed to release trains blocked by " +
                    train.trainID +
                    " after overtaking in " +
                    overtakingArea.overtakingAreaID +
                    ".",
                  error
                );
              }
            }
          ),
        ]
      ),
      otapi.on("trainCreated", (_, { trainID }): void => {
        const train = infrastructure.getOrThrow("train", trainID);

        otapi
          .sendInPause(({ send }): void => {
            for (const { routeID } of train.routes) {
              send("setRouteAllowed", { routeID, trainID });
            }
          })
          .catch((error): void => {
            log.error(error, `Can't allow routes for train ${trainID}.`, error);
          });
      }),
      otapi.on(
        "trainDeleted",
        async (_, { trainID, time }): Promise<void> => {
          const train = infrastructure.getOrThrow("train", trainID);

          log.log("--D-- Release trains blocked by " + trainID + `(${time}).`);

          for (const overtakingArea of overtakingAreas) {
            trainOvertaking
              .releaseTrains(overtakingArea, train)
              .catch((error): void => {
                log.error(
                  error,
                  "Failed to release trains blocked by " +
                    train.trainID +
                    " after overtaking in " +
                    overtakingArea.overtakingAreaID +
                    ".",
                  error
                );
              });
          }
        }
      ),
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
