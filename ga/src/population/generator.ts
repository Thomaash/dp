import { xor4096 } from "seedrandom";
import {
  InputConfig,
  Operator,
  OperatorFactory,
  PositiveInteger,
  Rng,
  Statement,
  StatementFactory,
  Terminal,
  TerminalFactory,
} from "../language";

type FixArgsFactories<Inputs extends InputConfig> = Map<
  PositiveInteger,
  OperatorFactory<Inputs, PositiveInteger>[]
>;

export class PopulationGenerator<Inputs extends InputConfig> {
  private readonly _rng: Rng;

  private readonly _fixedArgsOperatorFactories: FixArgsFactories<Inputs>;
  private readonly _operatorFactories: readonly OperatorFactory<
    Inputs,
    PositiveInteger
  >[];
  private readonly _statementFactories: readonly StatementFactory<Inputs>[];
  private readonly _terminalFactories: readonly TerminalFactory<Inputs>[];

  public constructor(
    public readonly seed: string,
    statements: readonly StatementFactory<Inputs>[]
  ) {
    this._rng = xor4096(seed);

    this._operatorFactories = statements.filter(
      (statement): statement is OperatorFactory<Inputs, PositiveInteger> =>
        statement.args > 0
    );
    this._statementFactories = statements;
    this._terminalFactories = statements.filter(
      (statement): statement is TerminalFactory<Inputs> => statement.args === 0
    );

    this._fixedArgsOperatorFactories = this._operatorFactories.reduce(
      (acc, factory): FixArgsFactories<Inputs> => {
        (
          acc.get(factory.args) || acc.set(factory.args, []).get(factory.args)!
        ).push(factory);

        return acc;
      },
      new Map()
    );
  }

  private _randomFrom<T>(arr: readonly T[]): T {
    return arr[Math.floor(arr.length * this._rng())];
  }

  public fixedArgsOperatorFactory<Args extends PositiveInteger>(
    args: Args
  ): OperatorFactory<Inputs, Args> {
    const factories:
      | OperatorFactory<Inputs, Args>[]
      | undefined = this._fixedArgsOperatorFactories.get(args) as
      | OperatorFactory<Inputs, Args>[]
      | undefined;

    if (factories == null) {
      throw new Error("There are no factories with given number of arguments.");
    } else {
      return this._randomFrom(factories);
    }
  }

  public operatorFactory(): OperatorFactory<Inputs, PositiveInteger> {
    return this._randomFrom(this._operatorFactories);
  }

  public statementFactory(): StatementFactory<Inputs> {
    return this._randomFrom(this._statementFactories);
  }

  public terminalFactory(): TerminalFactory<Inputs> {
    return this._randomFrom(this._terminalFactories);
  }

  public full(depth: 1): Terminal<Inputs>;
  public full(depth: number): Operator<Inputs, PositiveInteger>;
  public full(depth: number): Statement<Inputs> {
    if (depth > 1) {
      const factory = this.operatorFactory();
      return factory.create(
        factory.createOperandtuple(
          (): Statement<Inputs> => {
            return this.full(depth - 1);
          }
        )
      );
    } else {
      return this.terminalFactory().create(this._rng);
    }
  }

  public grow(min: number, max: 1): Terminal<Inputs>;
  public grow(min: number, max: number): Operator<Inputs, PositiveInteger>;
  public grow(min: number, max: number): Statement<Inputs> {
    if (max <= 1) {
      // Max size limit was reached, return a terminal.
      return this.terminalFactory().create(this._rng);
    } else if (min > 0) {
      // Min size was no reached yet, return an operator.
      const factory = this.operatorFactory();
      return factory.create(
        factory.createOperandtuple(
          (): Statement<Inputs> => {
            return this.grow(min - 1, max - 1);
          }
        )
      );
    } else {
      // It's withing min and max, pick at random.
      const factory = this.statementFactory();
      if (factory.args === 0) {
        return factory.create(this._rng);
      } else {
        return factory.create(
          factory.createOperandtuple(
            (): Statement<Inputs> => {
              return this.grow(min - 1, max - 1);
            }
          )
        );
      }
    }
  }

  public halfAndHalf(max: 1): Terminal<Inputs>;
  public halfAndHalf(max: number): Operator<Inputs, PositiveInteger>;
  public halfAndHalf(max: number): Statement<Inputs> {
    if (this._rng() < 0.5) {
      return this.grow(1, max);
    } else {
      return this.full(max);
    }
  }
}
