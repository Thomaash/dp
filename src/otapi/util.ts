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

export async function retry<T>(
  func: () => T,
  limit = Number.POSITIVE_INFINITY
): Promise<T> {
  for (let attempt = 1; ; ++attempt) {
    try {
      return await func();
    } catch (error) {
      if (attempt >= limit) {
        console.error(`Attempt #${attempt} failed, giving up.`, error);
        throw error;
      }

      console.error(
        `Attempt #${attempt} failed (${error.message}), retrying...`
      );

      await new Promise((resolve): void => {
        setTimeout(resolve, (attempt - 1) * 1000);
      });
    }
  }
}
