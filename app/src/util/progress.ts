import { CurryLog } from "../curry-log";
import { MapCounter } from "./maps-with-defaults";

export class Progress {
  private _decimalPlaces = 0;
  private _finished = new MapCounter<string>();
  private _padAmount = 0;
  private _total = 0;

  private _plannedLog: null | NodeJS.Timeout = null;

  private _start = 0;
  private _lastFinished = 0;

  public get finishedPerSecond(): number {
    const period = (this._lastFinished - this._start) / 1000;
    return this.finished / period;
  }
  public get percentage(): number {
    return this.finished / this.total;
  }
  public get finished(): number {
    return [...this._finished.values()].reduce<number>(
      (acc, counter): number => acc + counter.get(),
      0
    );
  }
  public get total(): number {
    return this._total;
  }

  public constructor(
    private readonly _log: CurryLog,
    private readonly _prefix: string
  ) {}

  public setTotal(total: number): this {
    this._total = total;
    this._padAmount = Math.max(0, ("" + total).length);
    this._decimalPlaces = Math.max(0, Math.ceil(Math.log10(total)) - 2);

    return this;
  }

  public finish(kind: string): this {
    this._finished.get(kind).inc();
    this._lastFinished = Date.now();

    this._planLog();

    return this;
  }

  public start(): this {
    this._start = Date.now();

    return this;
  }

  public stop(): this {
    this._cancelPlannedLog();
    this._logNow();

    return this;
  }

  private _cancelPlannedLog(): void {
    if (this._plannedLog != null) {
      global.clearTimeout(this._plannedLog);
      this._plannedLog = null;
    }
  }

  private _planLog(): void {
    if (this._plannedLog != null) {
      return;
    }

    this._plannedLog = global.setTimeout(this._logNow.bind(this), 1000);
  }

  private _logNow(): void {
    this._plannedLog = null;

    const finished = this._padWhole(this.finished);
    const total = this._padWhole(this.total);
    const percentage = this._padPercentage((this.finished / this.total) * 100);
    const finishedPerSecond = this.finishedPerSecond.toFixed(2);

    const kinds = [...this._finished]
      .map(
        ([kind, counter]): string =>
          `${this._padPercentage(
            (counter.get() / this.finished) * 100
          )}% ${kind}`
      )
      .join(", ");

    this._log.info(
      this._prefix +
        `${finished}/${total}, ${percentage}%, ${finishedPerSecond}/s (${kinds})`
    );
  }

  private _padWhole(number: number): string {
    return ("" + Math.round(number)).padStart(this._padAmount, " ");
  }

  private _padPercentage(number: number): string {
    return number
      .toFixed(this._decimalPlaces)
      .padStart(this._decimalPlaces + 4, " ");
  }
}
