import { OTAPI } from "../otapi";
import { CallbackQueue } from "../util";

export class TrainCounter {
  private readonly _trainIDs = new Set<string>();

  private readonly _cleanupCallbacks = new CallbackQueue("reverse");

  public get size(): number {
    return this._trainIDs.size;
  }

  public constructor(private readonly _otapi: OTAPI) {}

  public start(): () => void {
    this._cleanupCallbacks.plan(
      this._otapi.on("trainCreated", (_, { trainID }): void => {
        this._trainIDs.add(trainID);
      }),
      this._otapi.on("trainDeleted", (_, { trainID }): void => {
        this._trainIDs.delete(trainID);
      })
    );

    return this.stop.bind(this);
  }

  public stop(): void {
    this._cleanupCallbacks.execute();
  }
}
