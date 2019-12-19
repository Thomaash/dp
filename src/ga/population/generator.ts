import { xor4096 } from "seedrandom";
import {
  Rng,
  OperatorBuilder,
  PositiveInteger,
  TerminalBuilder,
  StatementBuilder,
  Terminal,
  Operator,
  Statement
} from "../language";

export class PopulationGenerator {
  private readonly _rng: Rng;

  private readonly _operatorBuilders: OperatorBuilder<PositiveInteger>[];
  private readonly _statementBuilders: StatementBuilder[];
  private readonly _terminalBuilders: TerminalBuilder[];

  public constructor(
    public readonly seed: string,
    statements: StatementBuilder[]
  ) {
    this._rng = xor4096(seed);

    this._operatorBuilders = statements.filter(
      (statement): statement is OperatorBuilder<PositiveInteger> =>
        statement.args > 0
    );
    this._statementBuilders = statements;
    this._terminalBuilders = statements.filter(
      (statement): statement is TerminalBuilder => statement.args === 0
    );
  }

  private _randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(arr.length * this._rng())];
  }

  public operatorBuilder(): OperatorBuilder<PositiveInteger> {
    return this._randomFrom(this._operatorBuilders);
  }

  public statementBuilder(): StatementBuilder {
    return this._randomFrom(this._statementBuilders);
  }

  public terminalBuilder(): TerminalBuilder {
    return this._randomFrom(this._terminalBuilders);
  }

  public full(depth: 1): Terminal;
  public full(depth: number): Operator<PositiveInteger>;
  public full(depth: number): Statement {
    if (depth > 1) {
      const builder = this.operatorBuilder();
      return builder.create(
        builder.createOperandtuple(
          (): Statement => {
            return this.full(depth - 1);
          }
        )
      );
    } else {
      return this.terminalBuilder().create(this._rng);
    }
  }

  public grow(min: number, max: 1): Terminal;
  public grow(min: number, max: number): Operator<PositiveInteger>;
  public grow(min: number, max: number): Statement {
    if (max <= 1) {
      // Max size limit was reached, return a terminal.
      return this.terminalBuilder().create(this._rng);
    } else if (min > 0) {
      // Min size was no reached yet, return an operator.
      const builder = this.operatorBuilder();
      return builder.create(
        builder.createOperandtuple(
          (): Statement => {
            return this.grow(min - 1, max - 1);
          }
        )
      );
    } else {
      // It's withing min and max, pick at random.
      const builder = this.statementBuilder();
      if (builder.args === 0) {
        return builder.create(this._rng);
      } else {
        return builder.create(
          builder.createOperandtuple(
            (): Statement => {
              return this.grow(min - 1, max - 1);
            }
          )
        );
      }
    }
  }
}
