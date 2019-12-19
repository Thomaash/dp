export * from "./types";

import { format } from "prettier";
import {
  NextInteger,
  Operator,
  OperatorBuilder,
  PositiveInteger,
  Statement,
  Terminal,
  TerminalBuilder,
  Tuple,
  Rng
} from "./types";
import { deepFreeze } from "../../util/deep-freeze";

// Generic {{{

function formatStatement(code: string): string {
  return (
    format(code, { filepath: "statement.ts", endOfLine: "lf" })
      // Remove the last two characters (linefeed and newline).
      .slice(0, -2)
  );
}

function createOperatorBuilder<Args extends PositiveInteger>(
  name: string,
  args: Args,
  ...codeFragments: Tuple<string, NextInteger[Args]>
): OperatorBuilder<Args> {
  function clone(this: Operator<Args>): Operator<Args> {
    return create(
      this.operands.map((operand): Statement => operand.clone()) as Tuple<
        Statement,
        Args
      >
    );
  }

  function create(operands: Tuple<Statement, Args>): Operator<Args> {
    const code = formatStatement(
      codeFragments.reduce((acc, codeFragment, i): string => {
        return i < operands.length
          ? `${acc} ${codeFragment} (${operands[i].code})`
          : acc + codeFragment;
      }, "")
    );

    const run = new Function(`"use strict"; return (${code});`);

    return deepFreeze({
      args,
      clone,
      code,
      name,
      operands,
      run
    });
  }

  return deepFreeze({ args, name, create });
}

function createTerminalBuilder(
  name: string,
  createCode: (rng: Rng) => string
): TerminalBuilder {
  function create(rng: Rng): Terminal {
    const code = createCode(rng);
    const run = new Function(`"use strict"; return (${code});`);

    function clone(this: Terminal): Terminal {
      return deepFreeze({
        args: 0,
        clone,
        code,
        name,
        run
      });
    }

    return deepFreeze({
      args: 0,
      clone,
      code,
      name,
      run
    });
  }

  return deepFreeze({ args: 0, name, create });
}

// }}}
// Terminals {{{

export const constant = createTerminalBuilder(
  "Constant",
  (rng: Rng): string => "" + rng()
);
export const bipolarConstant = createTerminalBuilder(
  "Bipolar Constant",
  (rng: Rng): string => "" + rng() * Math.sign(rng() - 0.5)
);
export const bool = createTerminalBuilder("Bool", (rng: Rng): string =>
  rng() < 0.5 ? "false" : "true"
);
export const smallIntegerConstant = createTerminalBuilder(
  "Small Integer Constant",
  (rng: Rng): string => "" + Math.floor(rng() * 100)
);
export const integerConstant = createTerminalBuilder(
  "Integer Constant",
  (rng: Rng): string => "" + Math.floor(rng() * 1000000)
);

// }}}
// Operators {{{

export const and = createOperatorBuilder("And", 2, "", "&&", "");
export const or = createOperatorBuilder("Or", 2, "", "||", "");
export const divide = createOperatorBuilder("Divide", 2, "", "/", "");
export const floor = createOperatorBuilder("Floor", 1, "Math.floor(", ")");
export const not = createOperatorBuilder("Not", 1, "!", "");
export const minus = createOperatorBuilder("Minus", 2, "", "-", "");
export const plus = createOperatorBuilder("Plus", 2, "", "+", "");
export const power = createOperatorBuilder("Power", 2, "", "**", "");
export const times = createOperatorBuilder("Times", 2, "", "*", "");

// }}}

// vim:fdm=marker
