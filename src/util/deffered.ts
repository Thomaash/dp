export class Deferred<T> {
  public readonly promise: Promise<T>;
  public resolve!: (value: T | PromiseLike<T>) => void;
  public reject!: (reason: Error) => void;

  public pending = true;
  public resolved = false;
  public rejected = false;

  public constructor() {
    this.promise = new Promise<T>((resolve, reject): void => {
      this.resolve = (...rest): void => {
        this.pending = false;
        this.resolved = true;

        resolve(...rest);
      };
      this.reject = (...rest): void => {
        this.pending = false;
        this.rejected = true;

        reject(...rest);
      };
    });
  }
}
