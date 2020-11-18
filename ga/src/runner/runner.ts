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
  createStatements as createAllStatements,
  createSubtreePopulationMutator,
  heightPenalty,
} from "../index-no-runner";
import { PopulationInquisitor } from "../population/inquisitor";
import { RunSummary, RunSummarySpecimen } from "./common";

export class GARunner<Inputs extends InputConfig> {
  public lastRun: RunSummary<Inputs> | null = null;

  private readonly _competition: PopulationCompetition<Inputs>;
  private readonly _crossover: PopulationCrossover<Inputs>;
  private readonly _generate: () => Statement<Inputs>;
  private readonly _generator: PopulationGenerator<Inputs>;
  private readonly _inquisitor: PopulationInquisitor<Inputs>;
  private readonly _mutate: MutateSpecimen<Inputs>;

  private _population: Statement<Inputs>[];

  // TODO: Reconsider API.
  public constructor(
    inputs: InputConfigJS<Inputs>,
    private readonly _rng: Rng,
    trainingFit: (statement: Statement<Inputs>) => number,
    populationSize = 100,
    createStatements: (
      inputs: InputConfigJS<Inputs>
    ) => readonly StatementFactory<Inputs>[] = createAllStatements,
    private readonly _saveRun: (
      runSummary: RunSummary<Inputs>
    ) => void = (): void => {},
    validationFit: (statement: Statement<Inputs>) => number
  ) {
    const statements = createStatements(inputs);

    this._generator = new PopulationGenerator("TEST", statements);
    this._generate = this._generator.halfAndHalf.bind(this._generator, 10);
    this._mutate = createSubtreePopulationMutator(
      "TEST",
      0.005,
      this._generate
    );
    this._competition = new PopulationCompetition(
      "TEST",
      trainingFit,
      [codeLengthPenalty(), heightPenalty()],
      validationFit
    );
    this._crossover = new PopulationCrossover("TEST");
    this._inquisitor = new PopulationInquisitor({
      dedupe: true,
      maxSize: 200,
    });

    this._population = new Array(populationSize).fill(null).map(this._generate);
  }

  private _runOnce(): void {
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

    let nextPopulation = [];

    // Create offsprings.
    while (nextPopulation.length < sorted.length - 2) {
      nextPopulation.push(
        ...this._crossover.subtree(
          sorted[Math.floor(this._rng() ** 2 * sorted.length)],
          sorted[Math.floor(this._rng() ** 2 * sorted.length)]
        )
      );
    }

    // Mutate offsprings.
    nextPopulation = nextPopulation.map(this._mutate);

    // Remove unsatisfactory.
    nextPopulation = this._inquisitor.inquire(nextPopulation);

    // Readd the best statements.
    nextPopulation.push(sorted[0], sorted[1]);

    // Fill in any missing spaces.
    while (nextPopulation.length < this._population.length) {
      nextPopulation.push(this._generate());
    }

    this._population = nextPopulation;
  }

  public run(amount = 1): void {
    for (let i = 0; i < amount; ++i) {
      this._runOnce();
    }
  }
}
