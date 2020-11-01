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

export interface Tuple<T extends any, L extends number>
  extends ReadonlyArray<T> {
  0: T;
  length: L;
}

export interface InputConfig {
  [key: string]: any;
}
export type InputConfigJS<Inputs> = {
  [Key in keyof Inputs]: Inputs[Key] extends boolean
    ? BooleanConstructor
    : Inputs[Key] extends number
    ? NumberConstructor
    : Inputs[Key] extends string
    ? StringConstructor
    : never;
};

export type Rng = () => number;

export interface OperatorFactory<
  Inputs extends InputConfig,
  Args extends PositiveInteger
> {
  args: Args;
  create(operands: Tuple<Statement<Inputs>, Args>): Operator<Inputs, Args>;
  createOperandtuple<U extends Statement<Inputs>>(
    callbackfn: (value: null, index: number, array: (null | U)[]) => U,
    thisArg?: any
  ): Tuple<U, Args>;
  name: string;
}
export interface TerminalFactory<Inputs extends InputConfig> {
  args: 0;
  create(rng: Rng): Terminal<Inputs>;
  name: string;
}
export type StatementFactory<Inputs extends InputConfig> =
  | OperatorFactory<Inputs, PositiveInteger>
  | TerminalFactory<Inputs>;

export type StatementRun<Inputs extends InputConfig> = (args: Inputs) => any;
export interface StatementBase<
  Inputs extends InputConfig,
  Args extends NonNegativeInteger
> {
  args: Args;
  clone(): StatementBase<Inputs, Args>;
  code: string;
  heightMax: number;
  heightMin: number;
  inputs: InputConfigJS<Inputs>;
  name: string;
  prettyCode: string;
  prettyFunction: string;
  run: StatementRun<Inputs>;
  size: number;
}
export interface Operator<
  Inputs extends InputConfig,
  Args extends PositiveInteger
> extends StatementBase<Inputs, Args>,
    OperatorFactory<Inputs, Args> {
  clone(): Operator<Inputs, Args>;
  create: OperatorFactory<Inputs, Args>["create"];
  operands: Tuple<Statement<Inputs>, Args>;
}
export interface Terminal<Inputs extends InputConfig>
  extends StatementBase<Inputs, 0>,
    TerminalFactory<Inputs> {
  clone(): Terminal<Inputs>;
  create: TerminalFactory<Inputs>["create"];
  heightMax: 1;
  heightMin: 1;
}
export type Statement<Inputs extends InputConfig> =
  | Operator<Inputs, PositiveInteger>
  | Terminal<Inputs>;
