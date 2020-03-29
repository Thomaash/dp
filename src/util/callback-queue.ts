export type VoidCallback = (() => void) | (() => Promise<void>);

export class CallbackQueue {
  private readonly _callbacks: VoidCallback[] = [];

  public constructor(
    private readonly _executeInReverse: false | "reverse" = false
  ) {}

  private _popCallbacks(): VoidCallback[] {
    return this._executeInReverse
      ? this._callbacks.splice(0).reverse()
      : this._callbacks.splice(0);
  }

  public plan(...callback: VoidCallback[]): void {
    this._callbacks.push(...callback);
  }

  public execute(): void {
    for (const callback of this._popCallbacks()) {
      callback();
    }
  }

  public async executeSerial(): Promise<void> {
    for (const callback of this._popCallbacks()) {
      await callback();
    }
  }

  public async executeParallel(): Promise<void> {
    await Promise.all(
      this._popCallbacks().map((callback): void | Promise<void> => callback())
    );
  }
}
