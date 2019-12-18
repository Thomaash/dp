export * from "./types";

import { format } from "prettier";
import {
  Operator,
  Terminal,
  Statement,
  PositiveInteger,
  NextInteger,
  Tuple
} from "./types";

// Generic {{{

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
    public readonly operands: Tuple<Statement, Args>
  ) {
    this.args = operands.length;
    Object.freeze(this);
  }

  public get code(): string {
    return formatStatement(
      this._code.reduce((acc, codeFragment, i): string => {
        return i < this.operands.length
          ? `${acc} ${codeFragment} (${this.operands[i].code})`
          : acc + codeFragment;
      }, "")
    );
  }

  public get run(): Function {
    return new Function(`"use strict"; return (${this.code});`);
  }

  public clone(): UniversalOperator<Args> {
    return new UniversalOperator(
      this.name,
      this._code,
      this.operands.map((operand): Statement => operand.clone()) as Tuple<
        Statement,
        Args
      >
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

// }}}
// Terminals {{{

// Bool {{{

export class Bool extends UniversalTerminal implements Terminal {
  public constructor(value: boolean) {
    super("Bool", "" + value);
  }
}

// }}}
// Constant {{{

export class Constant extends UniversalTerminal implements Terminal {
  public constructor(value: number) {
    super("constant", "" + value);
  }
}

// }}}
// RandomBipolarConstant {{{

export class RandomBipolarConstant extends UniversalTerminal
  implements Terminal {
  public constructor() {
    super(
      "RandomBipolarConstant",
      "" + Math.random() * Math.sign(Math.random() - 0.5)
    );
  }
}

// }}}

// }}}
// Operators {{{

// And {{{

export class And extends UniversalOperator<2> implements Operator<2> {
  public constructor(...operands: Tuple<Statement, 2>) {
    super("Minus", ["", "&&", ""], operands);
  }
}

// }}}
// Divide {{{

export class Divide extends UniversalOperator<2> implements Operator<2> {
  public constructor(...operands: Tuple<Statement, 2>) {
    super("Minus", ["", "/", ""], operands);
  }
}

// }}}
// Floor {{{

export class Floor extends UniversalOperator<1> implements Operator<1> {
  public constructor(...operands: Tuple<Statement, 1>) {
    super("Floor", ["Math.floor(", ")"], operands);
  }
}

// }}}
// Minus {{{

export class Minus extends UniversalOperator<2> implements Operator<2> {
  public constructor(...operands: Tuple<Statement, 2>) {
    super("Minus", ["", "-", ""], operands);
  }
}

// }}}
// Not {{{

export class Not extends UniversalOperator<1> implements Operator<1> {
  public constructor(...operands: Tuple<Statement, 1>) {
    super("Minus", ["!", ""], operands);
  }
}

// }}}
// Or {{{

export class Or extends UniversalOperator<2> implements Operator<2> {
  public constructor(...operands: Tuple<Statement, 2>) {
    super("Minus", ["", "||", ""], operands);
  }
}

// }}}
// Plus {{{

export class Plus extends UniversalOperator<2> implements Operator<2> {
  public constructor(...operands: Tuple<Statement, 2>) {
    super("Plus", ["", "+", ""], operands);
  }
}

// }}}
// Power {{{

export class Power extends UniversalOperator<2> implements Operator<2> {
  public constructor(...operands: Tuple<Statement, 2>) {
    super("Power", ["", "**", ""], operands);
  }
}

// }}}
// Times {{{

export class Times extends UniversalOperator<2> implements Operator<2> {
  public constructor(...operands: Tuple<Statement, 2>) {
    super("Minus", ["", "*", ""], operands);
  }
}

// }}}

// }}}

// vim:fdm=marker
