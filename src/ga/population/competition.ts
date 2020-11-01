import { InputConfig, Statement } from "../language";

export type FitFunction<Inputs extends InputConfig> = (
  statement: Statement<Inputs>
) => number;
export interface FitStats {
  combined: number;
  fit: number;
  penalty: number;
}
export type FitMap<Inputs extends InputConfig> = Map<
  Statement<Inputs>,
  FitStats
>;
export type ReadonlyFitMap<Inputs extends InputConfig> = ReadonlyMap<
  Statement<Inputs>,
  FitStats
>;

export const codeLengthPenalty = (strength = 0.0001): FitFunction<any> => {
  return (statement): number => 1 + statement.code.length ** 2 * strength;
};
export const heightPenalty = (strength = 0.0001): FitFunction<any> => {
  return (statement): number => 1 + statement.heightMax ** 2 * strength;
};

export class PopulationCompetition<Inputs extends InputConfig> {
  private readonly _penalties: FitFunction<Inputs>[];

  public constructor(
    public readonly seed: string,
    private readonly _fit: FitFunction<Inputs>,
    ...penalties: FitFunction<Inputs>[]
  ) {
    this._penalties = penalties;
  }

  public evaluateOne(statement: Statement<Inputs>): FitStats {
    const rawFit = Math.abs(this._fit(statement));
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
      const aStats = fitness.get(a);
      if (aStats == null) {
        throw new Error("Missing stats.");
      }

      const bStats = fitness.get(b);
      if (bStats == null) {
        throw new Error("Missing stats.");
      }

      return (
        aStats.combined - bStats.combined ||
        aStats.fit - bStats.fit ||
        aStats.penalty - bStats.penalty
      );
    });
  }
}
