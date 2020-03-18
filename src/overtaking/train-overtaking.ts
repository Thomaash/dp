import { Infrastructure, Train } from "../infrastructure";
import { OTAPI } from "../otapi";

import { Blocking } from "./util";
import { OvertakingArea, DecisionModule } from "./api-public";

export interface OvertakingParams {
  defaultModule: string;
  infrastructure: Infrastructure;
  modules: DecisionModule[];
  otapi: OTAPI;
}

export class TrainOvertaking {
  private readonly _blocking = new Blocking<string, string, string>();

  public constructor(
    private readonly _infrastructure: Infrastructure,
    private readonly _otapi: OTAPI
  ) {}

  private _getBlockRouteIDs(exitRouteID: string, stationID: string): string[] {
    return [
      exitRouteID,
      ...[
        ...this._infrastructure
          .getOrThrow("station", stationID)
          .outflowRoutes.values()
      ].map(({ routeID }): string => routeID)
    ];
  }

  private async _sendBlockRequests(
    exitRouteID: string,
    stationID: string,
    waitingTrainID: string
  ): Promise<void> {
    await this._otapi.sendInPause(({ send }): void => {
      for (const routeID of this._getBlockRouteIDs(exitRouteID, stationID)) {
        send("setRouteDisallowed", {
          trainID: waitingTrainID,
          routeID
        });
      }
    });
  }

  private async _sendReleaseRequests(
    exitRouteID: string,
    stationID: string,
    waitingTrainID: string
  ): Promise<void> {
    await this._otapi.sendInPause(({ send }): void => {
      for (const routeID of this._getBlockRouteIDs(exitRouteID, stationID)) {
        send("setRouteAllowed", {
          trainID: waitingTrainID,
          routeID
        });
      }
    });
  }

  async planOvertaking(
    { exitRoutes, outflowStation: station }: OvertakingArea,
    overtaking: Train,
    waiting: Train
  ): Promise<void> {
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
          this._sendBlockRequests(
            exitRoute.routeID,
            station.stationID,
            waiting.trainID
          )
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
        blocked: waiting.trainID
      })
    ) {
      // The train is still blocked at this station.
      return;
    }

    await Promise.all(
      [...exitRoutes.values()].map(
        (exitRoute): Promise<void> =>
          this._sendReleaseRequests(
            exitRoute.routeID,
            station.stationID,
            waiting.trainID
          )
      )
    );
  }

  async releaseTrains(
    { exitRoutes, outflowStation: station }: OvertakingArea,
    overtaking: Train
  ): Promise<void> {
    const blockedByOvertaking = this._blocking.unblockAll({
      place: station.stationID,
      blocker: overtaking.trainID
    });

    await Promise.all(
      blockedByOvertaking
        .filter(
          ({ blocked: waitingTrainID }): boolean =>
            !this._blocking.isBlockedQuery({
              place: station.stationID,
              blocked: waitingTrainID
            })
        )
        .flatMap(({ blocked: waitingTrainID }): Promise<void>[] =>
          [...exitRoutes.values()].map(
            (exitRoute): Promise<void> =>
              this._sendReleaseRequests(
                exitRoute.routeID,
                station.stationID,
                waitingTrainID
              )
          )
        )
    );
  }

  public dumpState(): void {
    this._blocking.dumpState();
  }
}
