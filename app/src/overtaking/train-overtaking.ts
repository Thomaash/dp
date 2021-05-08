import { Infrastructure, Route, Station, Train } from "../infrastructure";
import { OTAPI } from "../otapi";
import { CurryLog, curryCatch } from "../curry-log";

import { Blocking } from "./util";
import { DecisionModule, OvertakingArea } from "./api-public";
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
    overtakingArea: OvertakingArea,
    overtaking: Train,
    waiting: Train
  ): Promise<void> {
    const {
      exitRoutes,
      maxWaiting,
      outflowStation: station,
      waitingRoutes,
    } = overtakingArea;

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

    if (
      this._blocking.isBlocked(
        station.stationID,
        waiting.trainID,
        overtaking.trainID
      )
    ) {
      // Already planned the other way around. Cancel the previous one.
      this._log.warn(
        "Deadlock overtaking between " +
          waiting.trainID +
          " and " +
          overtaking.trainID +
          " requested at " +
          station.stationID +
          ". " +
          "Overtaking " +
          waiting.trainID +
          " by " +
          overtaking.trainID +
          "."
      );
      await this.cancelOvertaking(overtakingArea, waiting, overtaking);
    }

    if (
      // We can safely continue if the waiting train is already blocked at the
      // station.
      !this._blocking.isBlockedQuery({
        place: station.stationID,
        blocked: waiting.trainID,
      })
    ) {
      const numberOfBlockedTrains = this._blocking.countBlockedAtPlace(
        station.stationID
      );
      if (
        // We can safely continue only if max waiting wasn't reached yet.
        numberOfBlockedTrains >= maxWaiting
      ) {
        // Too many trains waiting at the station and the train that should be
        // overtaken here is not one of them.
        this._log.info(
          "Can't plan overtaking of " +
            waiting.trainID +
            " by " +
            overtaking.trainID +
            " as too many trains would be waiting at " +
            station.stationID +
            " (" +
            (numberOfBlockedTrains + 1) +
            " when the max is " +
            maxWaiting +
            ")."
        );
        return;
      }

      const shortestWaitingTrack = Math.min(
        ...[...waitingRoutes.values()]
          .filter((route): boolean => waiting.routes.has(route))
          .map(
            (route): number =>
              route.endSignalToReverseSignalDistance ?? Number.POSITIVE_INFINITY
          )
      );
      if (
        // We can only make the train wait on a track that is short enough.
        shortestWaitingTrack < waiting.length
      ) {
        // The train is too long and may cause a deadlock by blocking the
        // overtaking train from passing by.
        this._log.info(
          "Can't plan overtaking of " +
            waiting.trainID +
            " by " +
            overtaking.trainID +
            " as the train is to long to wait at " +
            station.stationID +
            " (the train has " +
            waiting.length +
            "m when shortest track has " +
            shortestWaitingTrack +
            "m)."
        );
        return;
      }
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
