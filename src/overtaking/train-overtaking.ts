import { Infrastructure, Train, Station, Route } from "../infrastructure";
import { OTAPI } from "../otapi";
import { curryCatch, CurryLog } from "../curry-log";

import { Blocking } from "./util";
import { OvertakingArea, DecisionModule } from "./api-public";
import { TrainTracker } from "src/train-tracker";

export interface OvertakingParams {
  defaultModule: string;
  infrastructure: Infrastructure;
  modules: DecisionModule[];
  otapi: OTAPI;
}

export class TrainOvertaking {
  private readonly _blocking: Blocking<string, string, string>;

  public constructor(
    private readonly _log: CurryLog,
    private readonly _infrastructure: Infrastructure,
    private readonly _otapi: OTAPI,
    private readonly _trainTracker: TrainTracker
  ) {
    this._blocking = new Blocking<string, string, string>(
      this._log("blocking")
    );

    // Possible workaround for one the countless bugs in OpenTrack.
    this._otapi.on("routeReserved", (_, { routeID, trainID }): void => {
      this._otapi.setRouteAllowed({ routeID, trainID }).catch(
        curryCatch(this._log, "Failed to allow reserved route.", {
          routeID,
          trainID,
        })
      );
    });
  }

  private _getBlockRoutes(
    exitRoute: Route,
    station: Station,
    train: Train
  ): Route[] {
    return [
      exitRoute,
      ...[...station.outflowRoutes.values()],
    ].filter((route): boolean => train.routes.has(route));
  }

  private async _sendBlockRequests(
    exitRoute: Route,
    station: Station,
    waitingTrain: Train
  ): Promise<void> {
    await this._otapi.sendInPause(({ send }): void => {
      for (const route of this._getBlockRoutes(
        exitRoute,
        station,
        waitingTrain
      )) {
        if (this._trainTracker.isReservedBy(waitingTrain, route)) {
          this._log.warn(
            `Can't block route ${route.routeID} for train ${waitingTrain.trainID} because it's already reserved by this train.`
          );
          continue;
        }

        send("setRouteDisallowed", {
          trainID: waitingTrain.trainID,
          routeID: route.routeID,
        });
      }
    });
    this._blocking.dumpState();
  }

  private async _sendReleaseRequests(
    exitRoute: Route,
    station: Station,
    waitingTrain: Train
  ): Promise<void> {
    await this._otapi.sendInPause(({ send }): void => {
      for (const route of this._getBlockRoutes(
        exitRoute,
        station,
        waitingTrain
      )) {
        send("setRouteAllowed", {
          trainID: waitingTrain.trainID,
          routeID: route.routeID,
        });
      }
    });
    this._blocking.dumpState();
  }

  async planOvertaking(
    { exitRoutes, outflowStation: station, maxWaiting }: OvertakingArea,
    overtaking: Train,
    waiting: Train
  ): Promise<void> {
    if (
      // We can safely continue if the waiting train is already blocket at the
      // station.
      !this._blocking.isBlockedQuery({
        place: station.stationID,
        blocked: waiting.trainID,
      }) &&
      // We can safely continue only if max waiting wasn't reached yet.
      this._blocking.countBlockedAtPlace(station.stationID) >= maxWaiting
    ) {
      // Too many trains waiting at the station and the train that should be
      // overtaken here is not one of them.
      this._log.info(
        `Can't plan overtaking of ${waiting.trainID} by ${overtaking.trainID} as too many trains would be waiting at ${station.stationID}.`
      );
      return;
    }

    if (
      this._blocking.isBlocked(
        station.stationID,
        overtaking.trainID,
        waiting.trainID
      )
    ) {
      // Already planned.
      return;
    }

    this._blocking.block(
      station.stationID,
      overtaking.trainID,
      waiting.trainID
    );

    await Promise.all(
      [...exitRoutes.values()].map(
        (exitRoute): Promise<void> =>
          this._sendBlockRequests(exitRoute, station, waiting)
      )
    );
  }

  async cancelOvertaking(
    { exitRoutes, outflowStation: station }: OvertakingArea,
    overtaking: Train,
    waiting: Train
  ): Promise<void> {
    if (
      !this._blocking.isBlocked(
        station.stationID,
        overtaking.trainID,
        waiting.trainID
      )
    ) {
      // Not planned.
      return;
    }

    this._blocking.unblock(
      station.stationID,
      overtaking.trainID,
      waiting.trainID
    );

    if (
      this._blocking.isBlockedQuery({
        place: station.stationID,
        blocked: waiting.trainID,
      })
    ) {
      // The train is still blocked at this station.
      return;
    }

    await Promise.all(
      [...exitRoutes.values()].map(
        (exitRoute): Promise<void> =>
          this._sendReleaseRequests(exitRoute, station, waiting)
      )
    );
  }

  async releaseTrains(
    { exitRoutes, outflowStation: station }: OvertakingArea,
    overtaking: Train
  ): Promise<void> {
    const blockedByOvertaking = this._blocking.unblockAll({
      place: station.stationID,
      blocker: overtaking.trainID,
    });

    await Promise.all(
      blockedByOvertaking
        .filter(
          ({ blocked: waitingTrainID }): boolean =>
            !this._blocking.isBlockedQuery({
              place: station.stationID,
              blocked: waitingTrainID,
            })
        )
        .flatMap(({ blocked: waitingTrainID }): Promise<void>[] =>
          [...exitRoutes.values()].map(
            (exitRoute): Promise<void> =>
              this._sendReleaseRequests(
                exitRoute,
                station,
                this._infrastructure.getOrThrow("train", waitingTrainID)
              )
          )
        )
    );

    await new Promise((resolve): void => void setTimeout(resolve, 10000));

    await Promise.all(
      blockedByOvertaking
        .filter(
          ({ blocked: waitingTrainID }): boolean =>
            !this._blocking.isBlockedQuery({
              place: station.stationID,
              blocked: waitingTrainID,
            })
        )
        .flatMap(({ blocked: waitingTrainID }): Promise<void>[] =>
          [...exitRoutes.values()].map(
            (exitRoute): Promise<void> =>
              this._sendReleaseRequests(
                exitRoute,
                station,
                this._infrastructure.getOrThrow("train", waitingTrainID)
              )
          )
        )
    );
  }

  public dumpState(): void {
    this._blocking.dumpState();
  }
}
