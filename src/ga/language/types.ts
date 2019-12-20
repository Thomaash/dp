export type NonNegativeInteger = 0 | PositiveInteger;
export type PositiveInteger = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export interface NextInteger {
  1: 2;
  2: 3;
  3: 4;
  4: 5;
  5: 6;
  6: 7;
  7: 8;
  8: 9;
  9: 10;
  10: 11;
  11: 12;
  12: 13;
}

export interface Tuple<T extends any, L extends number> extends Array<T> {
  0: T;
  length: L;
}

export interface Expression {
  root: Statement;
}

export type Rng = () => number;

export interface OperatorBuilder<Args extends PositiveInteger> {
  args: Args;
  create(operands: Tuple<Statement, Args>): Operator<Args>;
  createOperandtuple<U extends Statement>(
    callbackfn: (value: null, index: number, array: (null | U)[]) => U,
    thisArg?: any
  ): Tuple<U, Args>;
  name: string;
}
export interface TerminalBuilder {
  args: 0;
  create(rng: Rng): Terminal;
  name: string;
}
export type StatementBuilder =
  | OperatorBuilder<PositiveInteger>
  | TerminalBuilder;

export interface Operator<Args extends PositiveInteger> {
  args: Args;
  clone(): Operator<Args>;
  code: string;
  name: string;
  operands: (Operator<PositiveInteger> | Terminal)[] & { length: Args };
  prettyCode: string;
  run: Function;
}
export interface Terminal {
  args: 0;
  clone(): Terminal;
  code: string;
  name: string;
  prettyCode: string;
  run: Function;
}
export type Statement = Operator<PositiveInteger> | Terminal;
