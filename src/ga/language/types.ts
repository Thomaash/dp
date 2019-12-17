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
  root: Node;
}

export interface Operator<Args extends PositiveInteger> {
  args: Args;
  children: (Operator<PositiveInteger> | Terminal)[] & { length: Args };
  clone: () => Operator<Args>;
  code: string;
  name: string;
}
export interface Terminal {
  args: 0;
  clone: () => Terminal;
  code: string;
  name: string;
}
export type Node = Operator<PositiveInteger> | Terminal;
