export * from "../../util";

import { expect } from "chai";

import { NonNegativeInteger, Rng, Statement } from "../../../src/ga/language";

export const createRng = (seed = 0): Rng => (): number => {
  seed = (seed + 1) % 1000000;
  return seed / 1000000;
};

export const numberRE = /^-?\d+(\.\d+)?$/;

export const testCommon = <Args extends NonNegativeInteger>(
  args: Args,
  code: null | string | RegExp,
  statement: Statement
): void => {
  expect(
    statement,
    "There should be an args property equal to the number of operands"
  )
    .to.have.property("args")
    .that.is.a("number")
    .and.equals(args);

  expect(statement, "There should be a string code property")
    .to.have.property("code")
    .that.is.a("string");

  expect(statement, "There should be a string pretty code property")
    .to.have.property("prettyCode")
    .that.is.a("string");
  if (typeof code === "string") {
    expect(statement.prettyCode, "Unexpected code").to.equal(code);
  } else if (code instanceof RegExp) {
    expect(statement.prettyCode, "Unexpected code").to.match(code);
  }

  expect(statement, "There should be a function run property")
    .to.have.property("run")
    .that.is.a("function");

  expect((): void => {
    statement.run();
  }, "The code should not throw when run").to.not.throw();
};
