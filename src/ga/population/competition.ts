import { Statement } from "../language";

export type FitFunction = (statement: Statement) => number;
export interface FitStats {
  combined: number;
  fit: number;
  penalty: number;
}
export type FitMap = Map<Statement, FitStats>;
export type ReadonlyFitMap = ReadonlyMap<Statement, FitStats>;

export const codeLengthPenalty = (strength = 0.0001): FitFunction => {
  return (statement): number => 1 + statement.code.length ** 2 * strength;
};
export const heightPenalty = (strength = 0.0001): FitFunction => {
  return (statement): number => 1 + statement.heightMax ** 2 * strength;
};

export class PopulationCompetition {
  private readonly _penalties: FitFunction[];

  public constructor(
    public readonly seed: string,
    private readonly _fit: FitFunction,
    ...penalties: FitFunction[]
  ) {
    this._penalties = penalties;
  }

  public evaluateOne(statement: Statement): FitStats {
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

  public evaluateAll(statements: Statement[]): Map<Statement, FitStats> {
    return statements.reduce(
      (acc, statement): Map<Statement, FitStats> =>
        acc.set(statement, this.evaluateOne(statement)),
      new Map<Statement, FitStats>()
    );
  }

  public allVsAll(
    statements: Statement[],
    fitness: ReadonlyFitMap = this.evaluateAll(statements)
  ): Statement[] {
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
