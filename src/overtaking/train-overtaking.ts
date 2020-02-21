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

  private async _sendBlockRequests(
    exitRouteID: string,
    stationID: string,
    waitingTrainID: string
  ): Promise<void> {
    await Promise.all([
      this._otapi.setRouteDisallowed({
        trainID: waitingTrainID,
        routeID: exitRouteID
      }),
      this._otapi.setStop({
        stationID: stationID,
        stopFlag: true,
        trainID: waitingTrainID
      }),
      this._otapi.setDepartureTime({
        stationID: stationID,
        time: Number.MAX_SAFE_INTEGER,
        trainID: waitingTrainID
      })
    ]);
  }

  private async _sendReleaseRequests(
    exitRouteID: string,
    stationID: string,
    waiting: Train
  ): Promise<void> {
    await Promise.all([
      // Unblock exit route.
      this._otapi.setRouteAllowed({
        routeID: exitRouteID,
        trainID: waiting.trainID
      }),
      // Restore departure time.
      this._otapi.setDepartureTime({
        stationID: stationID,
        time:
          this._infrastructure.getTrainsDepartureFromStation(
            waiting,
            stationID
          ) ?? 0,
        trainID: waiting.trainID
      })
    ]);
  }

  async planOvertaking(
    { exitRoutes, station }: OvertakingArea,
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
    { exitRoutes, station }: OvertakingArea,
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
      !this._blocking.isBlockedQuery({
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
            waiting
          )
      )
    );
  }

  async releaseTrains(
    { exitRoutes, station }: OvertakingArea,
    overtaking: Train
  ): Promise<void> {
    const blockedByOvertaking = this._blocking.unblockAll({
      place: station.stationID,
      blocker: overtaking.trainID
    });

    await Promise.all(
      blockedByOvertaking
        .map(
          ({ blocked }): Train => {
            const train = this._infrastructure.trains.get(blocked);

            if (train == null) {
              throw new Error(`Couldn't find any train called ${blocked}.`);
            }

            return train;
          }
        )
        .filter(
          (waiting): boolean =>
            !this._blocking.isBlockedQuery({
              place: station.stationID,
              blocked: waiting.trainID
            })
        )
        .flatMap((waiting): Promise<void>[] =>
          [...exitRoutes.values()].map(
            (exitRoute): Promise<void> =>
              this._sendReleaseRequests(
                exitRoute.routeID,
                station.stationID,
                waiting
              )
          )
        )
    );
  }
}
