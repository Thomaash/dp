import { InputConfig, Statement } from "../language";

export interface PopulationInquisitorOptions {
  dedupe?: boolean;
  maxCodeLength?: number;
  maxHeight?: number;
  maxSize?: number;
}

export class PopulationInquisitor<Inputs extends InputConfig> {
  private readonly _options: Required<PopulationInquisitorOptions> = {
    dedupe: false,
    maxCodeLength: Number.POSITIVE_INFINITY,
    maxHeight: Number.POSITIVE_INFINITY,
    maxSize: Number.POSITIVE_INFINITY,
  };

  public constructor(options: PopulationInquisitorOptions = {}) {
    this._options = {
      ...this._options,
      ...options,
    };
  }

  private _dedupe(
    population: readonly Statement<Inputs>[]
  ): Statement<Inputs>[] {
    return [
      ...new Map<string, Statement<Inputs>>(
        population.map((statement): [string, Statement<Inputs>] => [
          statement.code,
          statement,
        ])
      ).values(),
    ];
  }

  public inquire(
    population: readonly Statement<Inputs>[]
  ): Statement<Inputs>[] {
    let v = population.filter(
      (statement): boolean =>
        statement.code.length <= this._options.maxCodeLength &&
        statement.heightMax <= this._options.maxHeight &&
        statement.size <= this._options.maxSize
    );

    if (this._options.dedupe) {
      v = this._dedupe(v);
    }

    return v;
  }
}
