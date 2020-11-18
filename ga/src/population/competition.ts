import { InputConfig, Statement } from "../language";

export type FitFunction<Inputs extends InputConfig> = (
  statement: Statement<Inputs>
) => number;
export interface FitStat {
  combined: number;
  fit: number;
  penalty: number;
}
export interface FitStats {
  training: FitStat;
  validation: FitStat;
}
export type FitMap<Inputs extends InputConfig> = Map<
  Statement<Inputs>,
  FitStats
>;
export type ReadonlyFitMap<Inputs extends InputConfig> = ReadonlyMap<
  Statement<Inputs>,
  FitStats
>;

export function leastSquaresFit<Inputs extends InputConfig>(
  inputs: readonly Inputs[],
  expectedResults: readonly number[]
): (statement: Statement<Inputs>) => number {
  return (statement: Statement<Inputs>): number =>
    inputs.reduce<number>(
      (acc, _v, i): number =>
        acc + (expectedResults[i] - statement.run(inputs[i])) ** 2,
      0
    ) / inputs.length;
}

export const codeLengthPenalty = (strength = 0.0001): FitFunction<any> => {
  return (statement): number => 1 + statement.code.length ** 2 * strength;
};
export const heightPenalty = (strength = 0.0001): FitFunction<any> => {
  return (statement): number => 1 + statement.heightMax ** 2 * strength;
};

export class PopulationCompetition<Inputs extends InputConfig> {
  public constructor(
    public readonly seed: string,
    private readonly _trainingFit: FitFunction<Inputs>,
    private readonly _penalties: FitFunction<Inputs>[],
    private readonly _validationFit?: FitFunction<Inputs>
  ) {}

  private _fit(
    statement: Statement<Inputs>,
    fitFun: FitFunction<Inputs>
  ): FitStat {
    const rawFit = Math.abs(fitFun(statement));
    const fit = Number.isNaN(rawFit) ? Number.POSITIVE_INFINITY : rawFit;

    const penalty = this._penalties.reduce((acc, penalize): number => {
      return acc * penalize(statement);
    }, 1);

    return {
      combined: fit * penalty,
      fit,
      penalty,
    };
  }

  public evaluateOne(statement: Statement<Inputs>): FitStats {
    const training = this._fit(statement, this._trainingFit);

    const validation = this._validationFit
      ? this._fit(statement, this._validationFit)
      : training;

    return {
      training,
      validation,
    };
  }

  public evaluateAll(
    statements: Statement<Inputs>[]
  ): Map<Statement<Inputs>, FitStats> {
    return statements.reduce(
      (acc, statement): Map<Statement<Inputs>, FitStats> =>
        acc.set(statement, this.evaluateOne(statement)),
      new Map<Statement<Inputs>, FitStats>()
    );
  }

  public allVsAll(
    statements: Statement<Inputs>[],
    fitness: ReadonlyFitMap<Inputs> = this.evaluateAll(statements)
  ): Statement<Inputs>[] {
    return statements.sort((a, b): number => {
      const aStat = fitness.get(a)?.training;
      if (aStat == null) {
        throw new Error("Missing stats.");
      }

      const bStat = fitness.get(b)?.training;
      if (bStat == null) {
        throw new Error("Missing stats.");
      }

      return (
        aStat.combined - bStat.combined ||
        aStat.fit - bStat.fit ||
        aStat.penalty - bStat.penalty
      );
    });
  }
}
