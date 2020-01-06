export * from "./types";

import { format } from "prettier";
import {
  NextInteger,
  Operator,
  OperatorFactory,
  PositiveInteger,
  Statement,
  Terminal,
  TerminalFactory,
  Tuple,
  Rng
} from "./types";

// Generic {{{

function formatStatement(code: string): string {
  return (
    format(code, { filepath: "statement.js", endOfLine: "lf" })
      // Remove the last two characters (linefeed and newline).
      .slice(0, -2)
  );
}

function createOperatorFactory<Args extends PositiveInteger>(
  name: string,
  args: Args,
  ...codeFragments: Tuple<string, NextInteger[Args]>
): OperatorFactory<Args> {
  function clone(this: Operator<Args>): Operator<Args> {
    return create(
      Object.freeze(
        this.operands.map((operand): Statement => operand.clone())
      ) as Tuple<Statement, Args>
    );
  }

  function createOperandtuple<U extends Statement>(
    callbackfn: (value: null, index: number, array: (null | U)[]) => U,
    thisArg?: any
  ): Tuple<U, Args> {
    return Object.freeze(
      new Array(args).fill(null).map(callbackfn, thisArg)
    ) as Tuple<U, Args>;
  }

  function create(operands: Tuple<Statement, Args>): Operator<Args> {
    const code = codeFragments.reduce((acc, codeFragment, i): string => {
      return i < operands.length
        ? `${acc} ${codeFragment} (${operands[i].code})`
        : acc + codeFragment;
    }, "");

    const run = new Function(`"use strict"; return (${code});`);

    return Object.freeze({
      args,
      clone,
      code,
      create,
      createOperandtuple,
      get prettyCode(): string {
        return formatStatement(code);
      },
      name,
      operands,
      run
    });
  }

  return Object.freeze({ args, create, createOperandtuple, name });
}

function createTerminalFactory(
  name: string,
  createCode: (rng: Rng) => string
): TerminalFactory {
  function create(rng: Rng): Terminal {
    const code = createCode(rng);
    const run = new Function(`"use strict"; return (${code});`);

    function clone(this: Terminal): Terminal {
      return Object.freeze({
        args: 0,
        clone,
        code,
        create,
        get prettyCode(): string {
          return formatStatement(code);
        },
        name,
        run
      });
    }

    return Object.freeze({
      args: 0,
      clone,
      code,
      create,
      get prettyCode(): string {
        return formatStatement(code);
      },
      name,
      run
    });
  }

  return Object.freeze({ args: 0, name, create });
}

// }}}
// Helpers {{{

export function isOperator(
  value: Statement
): value is Operator<PositiveInteger>;
export function isOperator<Args extends PositiveInteger>(
  args: Args,
  value: Statement
): value is Operator<Args>;
export function isOperator(
  ...rest: [Statement] | [number, Statement]
): boolean {
  return rest.length === 1 ? rest[0].args > 0 : rest[1].args === rest[0];
}
export function isTerminal(value: Statement): value is Terminal {
  return value.args === 0;
}

// }}}
// Terminals {{{

export const bipolarConstant = createTerminalFactory(
  "Bipolar Constant",
  (rng: Rng): string => "" + rng() * Math.sign(rng() - 0.5)
);
export const bool = createTerminalFactory("Bool", (rng: Rng): string =>
  rng() < 0.5 ? "false" : "true"
);
export const constant = createTerminalFactory(
  "Constant",
  (rng: Rng): string => "" + rng()
);
export const integerConstant = createTerminalFactory(
  "Integer Constant",
  (rng: Rng): string => "" + Math.floor(rng() * 1000000)
);
export const smallIntegerConstant = createTerminalFactory(
  "Small Integer Constant",
  (rng: Rng): string => "" + Math.floor(rng() * 100)
);

export const terminals = [
  bipolarConstant,
  bool,
  constant,
  integerConstant,
  smallIntegerConstant
];

// }}}
// Operators {{{

export const and = createOperatorFactory("And", 2, "", "&&", "");
export const divide = createOperatorFactory("Divide", 2, "", "/", "");
export const equals = createOperatorFactory("Equals", 2, "", "===", "");
export const floor = createOperatorFactory("Floor", 1, "Math.floor(", ")");
export const ifElse = createOperatorFactory("IfElse", 3, "", "?", ":", "");
export const lessThan = createOperatorFactory("LessThan", 2, "", "<", "");
export const minus = createOperatorFactory("Minus", 2, "", "-", "");
export const moreThan = createOperatorFactory("MoreThan", 2, "", ">", "");
export const not = createOperatorFactory("Not", 1, "!", "");
export const or = createOperatorFactory("Or", 2, "", "||", "");
export const plus = createOperatorFactory("Plus", 2, "", "+", "");
export const power = createOperatorFactory("Power", 2, "", "**", "");
export const times = createOperatorFactory("Times", 2, "", "*", "");
export const weakEquals = createOperatorFactory("WeakEquals", 2, "", "==", "");

export const operators = [
  and,
  divide,
  equals,
  floor,
  ifElse,
  lessThan,
  minus,
  moreThan,
  not,
  or,
  plus,
  power,
  times,
  weakEquals
];

// }}}
// Other {{{

export const statements = [...operators, ...terminals];

// }}}

// vim:fdm=marker
