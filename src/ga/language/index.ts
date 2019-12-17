export * from "./types";

import { format } from "prettier";
import {
  Operator,
  Terminal,
  Node,
  PositiveInteger,
  NextInteger,
  Tuple
} from "./types";

function formatStatement(code: string): string {
  return (
    format(code, { filepath: "statement.ts", endOfLine: "lf" })
      // Remove the last two characters (linefeed and newline).
      .slice(0, -2)
  );
}

export class UniversalOperator<Args extends PositiveInteger>
  implements Operator<Args> {
  public readonly args: Args;

  public constructor(
    public readonly name: string,
    private readonly _code: Tuple<string, NextInteger[Args]>,
    public readonly children: Tuple<Node, Args>
  ) {
    this.args = children.length;
    Object.freeze(this);
  }

  public get code(): string {
    return formatStatement(
      this._code.reduce((acc, codeFragment, i): string => {
        return i < this.children.length
          ? `${acc} ${codeFragment} (${this.children[i].code})`
          : acc + codeFragment;
      }, "")
    );
  }

  public clone(): UniversalOperator<Args> {
    return new UniversalOperator(
      this.name,
      this._code,
      this.children.map((child): Node => child.clone()) as Tuple<Node, Args>
    );
  }
}

export class UniversalTerminal implements Terminal {
  public readonly args = 0 as const;

  public constructor(
    public readonly name: string,
    public readonly code: string
  ) {
    Object.freeze(this);
  }

  public clone(): UniversalTerminal {
    return new UniversalTerminal(this.name, this.code);
  }
}

export class Constant extends UniversalTerminal implements Terminal {
  public constructor(value: number) {
    super("constant", "" + value);
  }
}

export class RandomBipolarConstant extends UniversalTerminal
  implements Terminal {
  public constructor() {
    super(
      "RandomBipolarConstant",
      "" + Math.random() * Math.sign(Math.random() - 0.5)
    );
  }
}

export class Plus extends UniversalOperator<2> implements Operator<2> {
  public constructor(...children: Tuple<Node, 2>) {
    super("Plus", ["", "+", ""], children);
  }
}

export class Minus extends UniversalOperator<2> implements Operator<2> {
  public constructor(...children: Tuple<Node, 2>) {
    super("Minus", ["", "-", ""], children);
  }
}
