import { Infrastructure } from "../infrastructure";
import { OTAPI } from "../otapi";
import { TrainTracker } from "../train-tracker";
import { CurryLog } from "../curry-log";

import { DecisionModule } from "./api-public";
import { DecisionModuleAPIFactory, getOvertakingData } from "./api";
import { TrainOvertaking } from "./train-overtaking";

export interface OvertakingParams {
  infrastructure: Infrastructure;
  log: CurryLog;
  module: DecisionModule;
  otapi: OTAPI;
}

export function overtaking({
  infrastructure,
  log,
  module,
  otapi,
}: OvertakingParams): {
  setup: () => Promise<void>;
  cleanup: () => Promise<void>;
} {
  const cleanupCallbacks: (() => void)[] = [];

  const overtakingData = getOvertakingData(infrastructure);
  const { overtakingAreas } = overtakingData;

  function setup(): Promise<void> {
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

    const removeListeners = [
      ...[...overtakingAreas.values()].flatMap(
        (overtakingArea): (() => void)[] => [
          tracker.onArea(
            "train-entered-area",
            overtakingArea,
            ({ train, route, time }): void => {
              otapi.pauseFor(
                async (): Promise<void> => {
                  try {
                    const { api, commit } = decisionModuleAPIFactory.get(
                      overtakingArea
                    );
                    await module.newTrainEnteredOvertakingArea(
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
              );
            }
          ),
          tracker.onArea(
            "train-left-area",
            overtakingArea,
            ({ train }): void => {
              otapi.pauseFor(
                async (): Promise<void> => {
                  try {
                    log.info(
                      "Train " +
                        train.trainID +
                        " left area " +
                        overtakingArea.overtakingAreaID +
                        ", release blocked trains."
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
              );
            }
          ),
        ]
      ),
      otapi.on("trainCreated", (_, { trainID }): void => {
        const train = infrastructure.getOrThrow("train", trainID);

        log.info(`Train ${trainID} was created, enable it's routes.`);

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
      otapi.on("trainDeleted", (_, { trainID }): void => {
        otapi.pauseFor(
          async (): Promise<void> => {
            const train = infrastructure.getOrThrow("train", trainID);

            log.info(`Train ${trainID} was deleted, release blocked trains.`);

            await Promise.all(
              overtakingAreas.map(
                (overtakingArea): Promise<void> =>
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
                    })
              )
            );
          }
        );
      }),
    ];
    cleanupCallbacks.push(...removeListeners);

    return Promise.resolve();
  }

  function cleanup(): Promise<void> {
    cleanupCallbacks
      .splice(0)
      .reverse()
      .forEach((callback): void => void callback());
    return Promise.resolve();
  }

  return { setup, cleanup };
}
