import {
  FitStats,
  MutateSpecimen,
  PopulationCompetition,
  PopulationCrossover,
  PopulationGenerator,
  Rng,
  Statement,
  StatementFactory,
  codeLengthPenalty,
  createSimplePopulationMutator,
  heightPenalty,
  input,
  statements,
} from "../../../src/ga";

// TODO: This should be exported from GA.
function regenerateDuplicates(
  population: readonly Statement[],
  generate: () => Statement
): Statement[] {
  const map = new Map<string, Statement>(
    population.map((statement): [string, Statement] => [
      statement.code,
      statement,
    ])
  );
  const unique = [...map.values()];
  while (unique.length < population.length) {
    unique.push(generate());
  }
  return unique;
}

export interface RunSummarySpecimen {
  specimen: Statement;
  fit: FitStats;
}
export interface RunSummary {
  number: number;
  specimens: readonly RunSummarySpecimen[];
}

export class GARunner<Inputs extends readonly any[], Result extends any> {
  public lastRun: RunSummary | null = null;

  private _competition: PopulationCompetition;
  private _crossover: PopulationCrossover;
  private _generator: PopulationGenerator;
  private _mutate: MutateSpecimen;
  private _population: Statement[];

  public constructor(
    private readonly _rng: Rng,
    private readonly _data: readonly Inputs[],
    private readonly _fit: (inputs: Inputs, result: Result) => number,
    private readonly _saveRun: (runSummary: RunSummary) => void = (): void => {}
  ) {
    this._generator = new PopulationGenerator("TEST", [
      ...statements,
      ...new Array(statements.length)
        .fill(null)
        .map((): StatementFactory => input),
    ]);
    this._mutate = createSimplePopulationMutator(
      "TEST",
      0.5,
      this._generator.halfAndHalf.bind(this._generator, 12)
    );
    this._competition = new PopulationCompetition(
      "TEST",
      (statement): number =>
        this._data.reduce<number>(
          (acc, inputs): number =>
            acc + this._fit(inputs, statement.run(...inputs)),
          0
        ) / this._data.length,
      codeLengthPenalty(),
      heightPenalty()
    );
    this._crossover = new PopulationCrossover("TEST");

    this._population = new Array(100)
      .fill(null)
      .map((): Statement => this._generator.halfAndHalf(12));
  }

  public run(): void {
    const fitness = this._competition.evaluateAll(this._population);
    const sorted = this._competition.allVsAll(this._population, fitness);

    this.lastRun = Object.freeze<RunSummary>({
      number: this.lastRun != null ? this.lastRun.number + 1 : 1,
      specimens: sorted.map(
        (specimen): RunSummarySpecimen =>
          Object.freeze<RunSummarySpecimen>({
            specimen,
            fit: Object.freeze<FitStats>(fitness.get(specimen)!),
          })
      ),
    });
    this._saveRun(this.lastRun);

    const nextGeneration = [];
    while (nextGeneration.length < sorted.length - 2) {
      nextGeneration.push(
        ...this._crossover.subtree(
          sorted[Math.floor(this._rng() ** 2 * sorted.length)],
          sorted[Math.floor(this._rng() ** 2 * sorted.length)]
        )
      );
    }

    nextGeneration.map(this._mutate);

    this._population = regenerateDuplicates(
      [...sorted.slice(0, 2), ...nextGeneration],
      (): Statement => this._generator.halfAndHalf(12)
    );
  }
}
