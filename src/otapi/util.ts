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
