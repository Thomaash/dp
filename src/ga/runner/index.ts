import {
  FitStats,
  InputConfig,
  InputConfigJS,
  MutateSpecimen,
  PopulationCompetition,
  PopulationCrossover,
  PopulationGenerator,
  Rng,
  Statement,
  StatementFactory,
  codeLengthPenalty,
  createInput,
  createSimplePopulationMutator,
  createStatements,
  heightPenalty,
} from "../../../src/ga";

// TODO: This should be exported from GA.
function regenerateDuplicates<Inputs extends InputConfig>(
  population: readonly Statement<Inputs>[],
  generate: () => Statement<Inputs>
): Statement<Inputs>[] {
  const map = new Map<string, Statement<Inputs>>(
    population.map((statement): [string, Statement<Inputs>] => [
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

export interface RunSummarySpecimen<Inputs extends InputConfig> {
  specimen: Statement<Inputs>;
  fit: FitStats;
}
export interface RunSummary<Inputs extends InputConfig> {
  number: number;
  specimens: readonly RunSummarySpecimen<Inputs>[];
}

export class GARunner<Inputs extends InputConfig, Result extends any> {
  public lastRun: RunSummary<Inputs> | null = null;

  private _competition: PopulationCompetition<Inputs>;
  private _crossover: PopulationCrossover<Inputs>;
  private _generator: PopulationGenerator<Inputs>;
  private _mutate: MutateSpecimen<Inputs>;
  private _population: Statement<Inputs>[];

  public constructor(
    inputs: InputConfigJS<Inputs>,
    private readonly _rng: Rng,
    data: readonly Inputs[],
    private readonly _fit: (inputs: Inputs, result: Result) => number,
    private readonly _saveRun: (
      runSummary: RunSummary<Inputs>
    ) => void = (): void => {}
  ) {
    const statements = createStatements(inputs);
    const input = createInput(inputs);

    this._generator = new PopulationGenerator("TEST", [
      ...statements,
      ...new Array(statements.length)
        .fill(null)
        .map((): StatementFactory<Inputs> => input),
    ]);
    this._mutate = createSimplePopulationMutator(
      "TEST",
      0.5,
      this._generator.halfAndHalf.bind(this._generator, 12)
    );
    this._competition = new PopulationCompetition(
      "TEST",
      (statement): number =>
        data.reduce<number>(
          (acc, inputs): number =>
            acc + this._fit(inputs, statement.run(inputs)),
          0
        ) / data.length,
      codeLengthPenalty(),
      heightPenalty()
    );
    this._crossover = new PopulationCrossover("TEST");

    this._population = new Array(100)
      .fill(null)
      .map((): Statement<Inputs> => this._generator.halfAndHalf(12));
  }

  public run(): void {
    const fitness = this._competition.evaluateAll(this._population);
    const sorted = this._competition.allVsAll(this._population, fitness);

    this.lastRun = Object.freeze<RunSummary<Inputs>>({
      number: this.lastRun != null ? this.lastRun.number + 1 : 1,
      specimens: sorted.map(
        (specimen): RunSummarySpecimen<Inputs> =>
          Object.freeze<RunSummarySpecimen<Inputs>>({
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
      (): Statement<Inputs> => this._generator.halfAndHalf(12)
    );
  }
}
