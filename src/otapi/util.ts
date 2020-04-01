import { createIDGenerator } from "../util";

export class Semaphore {
  private readonly _queue: (() => void)[] = [];

  public constructor(private _count: number = 1) {}

  public enter(): Promise<void> {
    return new Promise((resolve): void => {
      if (this._count > 0) {
        --this._count;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  public leave(): void {
    const resolve = this._queue.shift();
    if (resolve == null) {
      ++this._count;
    } else {
      resolve();
    }
  }
}

export class RateLimiter {
  private readonly _semaphore: Semaphore;

  public constructor(limit = 1) {
    this._semaphore = new Semaphore(limit);
  }

  public async run<Rest extends any[], Ret>(
    func: (...rest: Rest) => Promise<Ret>,
    ...rest: Rest
  ): Promise<Ret> {
    await this._semaphore.enter();
    const ret = await func(...rest);
    this._semaphore.leave();
    return ret;
  }
}

const nextRetryID = createIDGenerator("R");

export function retry<T>(
  func: () => T | Promise<T>,
  limit = Number.POSITIVE_INFINITY
): { result: Promise<T>; cancel: (error?: Error) => void } {
  const id = nextRetryID();
  let cancelError: null | Error = null;

  return {
    result: (async (): Promise<T> => {
      for (let attempt = 1; ; ++attempt) {
        if (cancelError != null) {
          console.error(`${id}: Canceled after #${attempt - 1} attempts.`);
          throw cancelError;
        }

        try {
          return await func();
        } catch (error) {
          if (attempt >= limit) {
            console.error(
              `${id}: Attempt #${attempt} failed, giving up.`,
              error
            );
            throw error;
          }

          console.error(
            `${id}: Attempt #${attempt} failed (${error.message}), retrying...`
          );

          await new Promise((resolve): void => {
            setTimeout(resolve, (attempt - 1) * 1000);
          });
        }
      }
    })(),
    cancel(error: Error = new Error("Canceled.")): void {
      cancelError = error;
    },
  };
}
