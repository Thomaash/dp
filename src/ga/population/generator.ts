import { xor4096 } from "seedrandom";
import {
  Operator,
  OperatorFactory,
  PositiveInteger,
  Rng,
  Statement,
  StatementFactory,
  Terminal,
  TerminalFactory
} from "../language";

export class PopulationGenerator {
  private readonly _rng: Rng;

  private readonly _operatorFactories: OperatorFactory<PositiveInteger>[];
  private readonly _statementFactories: StatementFactory[];
  private readonly _terminalFactories: TerminalFactory[];

  public constructor(
    public readonly seed: string,
    statements: StatementFactory[]
  ) {
    this._rng = xor4096(seed);

    this._operatorFactories = statements.filter(
      (statement): statement is OperatorFactory<PositiveInteger> =>
        statement.args > 0
    );
    this._statementFactories = statements;
    this._terminalFactories = statements.filter(
      (statement): statement is TerminalFactory => statement.args === 0
    );
  }

  private _randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(arr.length * this._rng())];
  }

  public operatorFactory(): OperatorFactory<PositiveInteger> {
    return this._randomFrom(this._operatorFactories);
  }

  public statementFactory(): StatementFactory {
    return this._randomFrom(this._statementFactories);
  }

  public terminalFactory(): TerminalFactory {
    return this._randomFrom(this._terminalFactories);
  }

  public full(depth: 1): Terminal;
  public full(depth: number): Operator<PositiveInteger>;
  public full(depth: number): Statement {
    if (depth > 1) {
      const factory = this.operatorFactory();
      return factory.create(
        factory.createOperandtuple(
          (): Statement => {
            return this.full(depth - 1);
          }
        )
      );
    } else {
      return this.terminalFactory().create(this._rng);
    }
  }

  public grow(min: number, max: 1): Terminal;
  public grow(min: number, max: number): Operator<PositiveInteger>;
  public grow(min: number, max: number): Statement {
    if (max <= 1) {
      // Max size limit was reached, return a terminal.
      return this.terminalFactory().create(this._rng);
    } else if (min > 0) {
      // Min size was no reached yet, return an operator.
      const factory = this.operatorFactory();
      return factory.create(
        factory.createOperandtuple(
          (): Statement => {
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
            (): Statement => {
              return this.grow(min - 1, max - 1);
            }
          )
        );
      }
    }
  }
}
