export * from "./types";

import { Options, format } from "prettier";
import {
  InputConfig,
  InputConfigJS,
  NextInteger,
  Operator,
  OperatorFactory,
  PositiveInteger,
  Rng,
  Statement,
  StatementFactory,
  StatementRun,
  Terminal,
  TerminalFactory,
  Tuple,
} from "./types";

// Generic {{{

const formatConfig: Options = { filepath: "file.js", endOfLine: "lf" };

function turnCodeIntoFunction(inputs: InputConfig, code: string): string {
  const keys = Object.keys(inputs);

  const params = keys.length > 0 ? `{ ${Object.keys(inputs).join(", ")} }` : "";
  const body = `"use strict";return (${code});`;

  return `function f(${params}) {${body}}`;
}
function formatCodeIntoStatement(code: string): string {
  return (
    format(code, formatConfig)
      // Remove the last two characters (linefeed and newline).
      .slice(0, -2)
  );
}
function formatCodeIntoFunction(inputs: InputConfig, code: string): string {
  const keys = Object.keys(inputs);
  return keys.length > 0
    ? format(
        `function f({ ${Object.keys(inputs).join(", ")} }) {"use strict";` +
          `return (${code});` +
          "}",
        formatConfig
      )
    : format(`"use strict";return (${code});`, formatConfig);
}

function createRunFunction<Inputs extends InputConfig>(
  inputs: Inputs,
  code: string
): StatementRun<Inputs>;
function createRunFunction(
  inputs: Record<string, any>,
  code: string
): Function {
  const keys = Object.keys(inputs);
  return keys.length > 0
    ? new Function(
        '"use strict";' +
          `const [{ ${keys.join(", ")} }] = arguments;` +
          `return (${code});`
      )
    : new Function(`"use strict";return (${code});`);
}

function createOperatorFactory<
  Inputs extends InputConfig,
  Args extends PositiveInteger
>(
  name: string,
  args: Args,
  inputs: InputConfigJS<Inputs>,
  ...codeFragments: Tuple<string, NextInteger[Args]>
): OperatorFactory<Inputs, Args> {
  function clone(this: Operator<Inputs, Args>): Operator<Inputs, Args> {
    return create(
      Object.freeze(
        this.operands.map((operand): Statement<Inputs> => operand.clone())
      ) as Tuple<Statement<Inputs>, Args>
    );
  }

  function createOperandtuple<U extends Statement<Inputs>>(
    callbackfn: (value: null, index: number, array: (null | U)[]) => U,
    thisArg?: any
  ): Tuple<U, Args> {
    return Object.freeze(
      new Array(args).fill(null).map(callbackfn, thisArg)
    ) as Tuple<U, Args>;
  }

  function create(
    operands: Tuple<Statement<Inputs>, Args>
  ): Operator<Inputs, Args> {
    const code = codeFragments.reduce<string>(
      (acc, codeFragment, i): string => {
        return i < operands.length
          ? `${acc} ${codeFragment} (${operands[i].code})`
          : acc + codeFragment;
      },
      ""
    );

    const heightMax =
      1 +
      operands.reduce<number>((acc, operand): number => {
        return Math.max(acc, operand.heightMax);
      }, Number.NEGATIVE_INFINITY);
    const heightMin =
      1 +
      operands.reduce<number>((acc, operand): number => {
        return Math.min(acc, operand.heightMin);
      }, Number.POSITIVE_INFINITY);

    const size =
      1 +
      operands.reduce<number>((acc, operand): number => acc + operand.size, 0);

    let cachedRun: StatementRun<Inputs> | null = null;

    const ret: Operator<Inputs, Args> = {
      get prettyCode(): string {
        return formatCodeIntoStatement(code);
      },
      get function(): string {
        return turnCodeIntoFunction(inputs, code);
      },
      get prettyFunction(): string {
        return formatCodeIntoFunction(inputs, code);
      },
      get run(): (inputs: Inputs) => any {
        return cachedRun ?? (cachedRun = createRunFunction(inputs, code));
      },

      args,
      clone,
      code,
      create,
      createOperandtuple,
      heightMax,
      heightMin,
      inputs,
      name,
      operands,
      size,
    };
    Object.freeze<Operator<Inputs, Args>>(ret);
    return ret;
  }

  return Object.freeze<OperatorFactory<Inputs, Args>>({
    args,
    create,
    createOperandtuple,
    name,
  });
}

function createTerminalFactory<Inputs extends InputConfig>(
  name: string,
  createCode: (rng: Rng) => string,
  inputs: InputConfigJS<Inputs>
): TerminalFactory<Inputs> {
  function create(rng: Rng): Terminal<Inputs> {
    const code = createCode(rng);

    let cachedRun: StatementRun<Inputs> | null = null;

    function clone(): Terminal<Inputs> {
      const ret: Terminal<Inputs> = {
        get prettyCode(): string {
          return formatCodeIntoStatement(code);
        },
        get function(): string {
          return turnCodeIntoFunction(inputs, code);
        },
        get prettyFunction(): string {
          return formatCodeIntoFunction(inputs, code);
        },
        get run(): (inputs: Inputs) => any {
          return cachedRun ?? (cachedRun = createRunFunction(inputs, code));
        },

        args: 0,
        clone,
        code,
        create,
        heightMax: 1,
        heightMin: 1,
        inputs,
        name,
        size: 1,
      };
      Object.freeze<Terminal<Inputs>>(ret);
      return ret;
    }

    return clone();
  }

  return Object.freeze({ args: 0, name, create });
}

// }}}
// Helpers {{{

export function isOperator<
  Inputs extends InputConfig,
  Args extends PositiveInteger
>(value: Statement<Inputs>): value is Operator<Inputs, Args>;
export function isOperator<
  Inputs extends InputConfig,
  Args extends PositiveInteger
>(args: Args, value: Statement<Inputs>): value is Operator<Inputs, Args>;
export function isOperator<Inputs extends InputConfig>(
  ...rest: [Statement<Inputs>] | [number, Statement<Inputs>]
): boolean {
  return rest.length === 1 ? rest[0].args > 0 : rest[1].args === rest[0];
}
export function isTerminal<Inputs extends InputConfig>(
  value: Statement<Inputs>
): value is Terminal<Inputs> {
  return value.args === 0;
}

// }}}
// Terminals {{{

export function createBipolarConstant<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): TerminalFactory<Inputs> {
  return createTerminalFactory(
    "Bipolar Constant",
    (rng: Rng): string => "" + rng() * Math.sign(rng() - 0.5),
    inputs
  );
}
export function createBool<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): TerminalFactory<Inputs> {
  return createTerminalFactory(
    "Bool",
    (rng: Rng): string => (rng() < 0.5 ? "false" : "true"),
    inputs
  );
}
export function createConstant<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): TerminalFactory<Inputs> {
  return createTerminalFactory(
    "Constant",
    (rng: Rng): string => "" + rng(),
    inputs
  );
}
export function createIntegerConstant<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): TerminalFactory<Inputs> {
  return createTerminalFactory(
    "Integer Constant",
    (rng: Rng): string => "" + Math.floor(rng() * 1000000),
    inputs
  );
}
export function createInput<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): TerminalFactory<Inputs> {
  return createTerminalFactory(
    "Input",
    (rng: Rng): string =>
      ((a): string => a[Math.floor(a.length * rng())])(Object.keys(inputs)),
    inputs
  );
}
export function createSmallIntegerConstant<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): TerminalFactory<Inputs> {
  return createTerminalFactory(
    "Small Integer Constant",
    (rng: Rng): string => "" + Math.floor(rng() * 100),
    inputs
  );
}

export function createTerminals<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): readonly TerminalFactory<Inputs>[] {
  return Object.freeze<TerminalFactory<Inputs>>([
    createBipolarConstant(inputs),
    createBool(inputs),
    createConstant(inputs),
    createIntegerConstant(inputs),
    createSmallIntegerConstant(inputs),
  ]);
}

// }}}
// Operators {{{

export function createAnd<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("And", 2, inputs, "", "&&", "");
}
export function createCeil<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 1> {
  return createOperatorFactory("Ceil", 1, inputs, "Math.ceil(", ")");
}
export function createDivide<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("Divide", 2, inputs, "", "/", "");
}
export function createEquals<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("Equals", 2, inputs, "", "===", "");
}
export function createFloor<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 1> {
  return createOperatorFactory("Floor", 1, inputs, "Math.floor(", ")");
}
export function createIfElse<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 3> {
  return createOperatorFactory("IfElse", 3, inputs, "", "?", ":", "");
}
export function createLessThan<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("LessThan", 2, inputs, "", "<", "");
}
export function createMinus<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("Minus", 2, inputs, "", "-", "");
}
export function createMoreThan<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("MoreThan", 2, inputs, "", ">", "");
}
export function createNot<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 1> {
  return createOperatorFactory("Not", 1, inputs, "!", "");
}
export function createOr<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("Or", 2, inputs, "", "||", "");
}
export function createPlus<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("Plus", 2, inputs, "", "+", "");
}
export function createPower<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("Power", 2, inputs, "", "**", "");
}
export function createRound<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 1> {
  return createOperatorFactory("Round", 1, inputs, "Math.round(", ")");
}
export function createTimes<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("Times", 2, inputs, "", "*", "");
}
export function createWeakEquals<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): OperatorFactory<Inputs, 2> {
  return createOperatorFactory("WeakEquals", 2, inputs, "", "==", "");
}

export function createOperators<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): readonly OperatorFactory<Inputs, 1 | 2 | 3>[] {
  return Object.freeze<OperatorFactory<Inputs, 1 | 2 | 3>>([
    createAnd(inputs),
    createDivide(inputs),
    createEquals(inputs),
    createFloor(inputs),
    createIfElse(inputs),
    createLessThan(inputs),
    createMinus(inputs),
    createMoreThan(inputs),
    createNot(inputs),
    createOr(inputs),
    createPlus(inputs),
    createPower(inputs),
    createTimes(inputs),
    createWeakEquals(inputs),
  ]);
}

// }}}
// Other {{{

export function createStatements<Inputs extends InputConfig>(
  inputs: InputConfigJS<Inputs>
): readonly StatementFactory<Inputs>[] {
  return Object.freeze<StatementFactory<Inputs>>([
    ...createOperators(inputs),
    ...createTerminals(inputs),
  ]);
}

// }}}

// vim:fdm=marker
