import { expect } from "chai";
import { xor4096 } from "seedrandom";
import snapshot from "snap-shot-it";

import {
  InputConfigJS,
  NonNegativeInteger,
  OperatorFactory,
  PositiveInteger,
  Terminal,
  createAnd,
  createBipolarConstant,
  createBool,
  createConstant,
  createDivide,
  createFloor,
  createInput,
  createIntegerConstant,
  createMinus,
  createNot,
  createOr,
  createPlus,
  createPower,
  createTimes,
} from "../../../src/ga/language";
import { createRng, ddIt, numberRE, testCommon } from "../util";

describe("Language", function (): void {
  interface Inputs0 {}
  const inputs: InputConfigJS<Inputs0> = {};

  const and = createAnd(inputs);
  const bipolarConstant = createBipolarConstant(inputs);
  const bool = createBool(inputs);
  const constant = createConstant(inputs);
  const divide = createDivide(inputs);
  const floor = createFloor(inputs);
  const integerConstant = createIntegerConstant(inputs);
  const minus = createMinus(inputs);
  const not = createNot(inputs);
  const or = createOr(inputs);
  const plus = createPlus(inputs);
  const power = createPower(inputs);
  const times = createTimes(inputs);

  interface Inputs2 {
    a: number;
    b: number;
  }
  const inputs2: InputConfigJS<Inputs2> = {
    a: Number,
    b: Number,
  };

  const input2 = createInput<Inputs2>(inputs2);
  const times2 = createTimes<Inputs2>(inputs2);

  interface Inputs3 {
    a: number;
    b: number;
    c: number;
  }
  const inputs3: InputConfigJS<Inputs3> = {
    a: Number,
    b: Number,
    c: Number,
  };

  const input3 = createInput<Inputs3>(inputs3);
  const minus3 = createMinus<Inputs3>(inputs3);
  const plus3 = createPlus<Inputs3>(inputs3);
  const times3 = createTimes<Inputs3>(inputs3);

  it("Code construction", function (): void {
    const rng = createRng();

    const c1 = integerConstant.create(rng);
    const c2 = integerConstant.create(rng);
    const c3 = integerConstant.create(rng);
    const c4 = integerConstant.create(rng);

    const p1 = plus.create([c1, c2]);
    const p2 = plus.create([c3, c4]);

    const m1 = minus.create([p1, p2]);

    testCommon(0, "1", c1);
    testCommon(0, "2", c2);
    testCommon(0, "3", c3);
    testCommon(0, "4", c4);
    testCommon(2, "1 + 2", p1);
    testCommon(2, "3 + 4", p2);
    testCommon(2, "1 + 2 - (3 + 4)", m1);
  });

  it("Cloning", function (): void {
    const rng = createRng();

    const c1 = integerConstant.create(rng);
    const c2 = integerConstant.create(rng);
    const c3 = integerConstant.create(rng);
    const c4 = integerConstant.create(rng);

    const p1 = plus.create([c1, c2]);
    const p2 = plus.create([c3, c4]);

    const m1 = minus.create([p1, p2]);

    const m2 = m1.clone();

    testCommon(0, "1", c1);
    testCommon(0, "2", c2);
    testCommon(0, "3", c3);
    testCommon(0, "4", c4);
    testCommon(2, "1 + 2", p1);
    testCommon(2, "3 + 4", p2);
    testCommon(2, "1 + 2 - (3 + 4)", m1);
    testCommon(2, "1 + 2 - (3 + 4)", m2);

    // Same structure.
    expect(m1).to.have.property("operands").that.has.lengthOf(2);
    expect(m1.operands[0]).to.have.property("operands").that.has.lengthOf(2);
    expect(m1.operands[1]).to.have.property("operands").that.has.lengthOf(2);

    // Same code.
    expect(m2).to.have.property("code").that.equals(m1.code);

    // Different instances.
    const a1: any = m1;
    const a2: any = m2;
    expect(a1).to.not.equal(a2);
    expect(a1.operands).to.not.equal(a2.operands);
    expect(a1.operands[0]).to.not.equal(a2.operands[0]);
    expect(a1.operands[0].operands[0]).to.not.equal(a2.operands[0].operands[0]);
    expect(a1.operands[0].operands[1]).to.not.equal(a2.operands[0].operands[1]);
    expect(a1.operands[1]).to.not.equal(a2.operands[1]);
    expect(a1.operands[1].operands[0]).to.not.equal(a2.operands[1].operands[0]);
    expect(a1.operands[1].operands[1]).to.not.equal(a2.operands[1].operands[1]);
  });

  it("Random Bipolar Constant", function (): void {
    this.timeout(20000);

    const rng = xor4096("TEST");

    const rbcs = new Array(1000).fill(null).map(
      (): Terminal<Inputs0> => {
        return bipolarConstant.create(rng);
      }
    );

    rbcs.forEach((rbc): void => {
      testCommon(0, numberRE, rbc);

      expect(rbc.prettyCode).to.match(
        /^-?\d+(\.\d+)?$/,
        "Bipolar constant should be a number."
      );
      expect(+rbc.prettyCode, "Bipolar constant should be within (-1, 1) range")
        .to.be.lessThan(1)
        .and.greaterThan(-1);
    });
  });

  describe("Inputs", function (): void {
    ddIt(
      "Order independent",
      (): ((inputs: Inputs2) => number) => {
        const p1 = input2.create((): number => 0 / 2);
        const p2 = input2.create((): number => 1 / 2);

        return times2.create([p1, p2]).run;
      },
      (given): void => {
        given({ a: 2, b: 3 }).expect(6, "Both inputs should be used.");
      }
    );

    ddIt(
      "Order dependent",
      (): ((inputs: Inputs3) => number) => {
        const p1 = input3.create((): number => 0 / 3);
        const p2 = input3.create((): number => 1 / 3);
        const p3 = input3.create((): number => 2 / 3);

        const o1 = plus3.create([p3, p2]);
        const o2 = minus3.create([p1, p3]);
        const o3 = times3.create([o1, o2]);

        snapshot(o3.prettyFunction);

        return o3.run;
      },
      (given): void => {
        given({ a: 1, b: 2, c: 3 }).expect(-10);
        given({ a: 1, b: 3, c: 2 }).expect(-5);
        given({ a: 2, b: 1, c: 3 }).expect(-4);
        given({ a: 2, b: 3, c: 1 }).expect(4);
        given({ a: 3, b: 1, c: 2 }).expect(3);
        given({ a: 3, b: 2, c: 1 }).expect(6);
      }
    );
  });

  describe("Operators", function (): void {
    const configs: [
      OperatorFactory<Inputs0, PositiveInteger>,
      any[],
      string,
      any
    ][] = [
      // [Divide, [0, 0], "0 / 0", Number.NaN], // TODO
      [and, [false, false], "false && false", false],
      [and, [false, true], "false && true", false],
      [and, [true, false], "true && false", false],
      [and, [true, true], "true && true", true],
      [divide, [-77, -11], "-77 / -11", 7],
      [divide, [1, -16], "1 / -16", -0.0625],
      [divide, [21, 7], "21 / 7", 3],
      [floor, [-0.3], "Math.floor(-0.3)", -1],
      [floor, [-0.5], "Math.floor(-0.5)", -1],
      [floor, [-0.7], "Math.floor(-0.7)", -1],
      [floor, [-1], "Math.floor(-1)", -1],
      [floor, [0.3], "Math.floor(0.3)", 0],
      [floor, [0.5], "Math.floor(0.5)", 0],
      [floor, [0.7], "Math.floor(0.7)", 0],
      [floor, [0], "Math.floor(0)", 0],
      [floor, [1], "Math.floor(1)", 1],
      [minus, [-77, -14], "-77 - -14", -63],
      [minus, [0, 0], "0 - 0", 0],
      [minus, [1, -14], "1 - -14", 15],
      [minus, [33, 456789], "33 - 456789", -456756],
      [not, [false], "!false", true],
      [not, [true], "!true", false],
      [or, [false, false], "false || false", false],
      [or, [false, true], "false || true", true],
      [or, [true, false], "true || false", true],
      [or, [true, true], "true || true", true],
      [plus, [-77, -14], "-77 + -14", -91],
      [plus, [0, 0], "0 + 0", 0],
      [plus, [1, -14], "1 + -14", -13],
      [plus, [33, 456789], "33 + 456789", 456822],
      [power, [-2, -3], "(-2) ** -3", -0.125],
      [power, [-2, 10], "(-2) ** 10", 1024],
      [power, [2, -3], "2 ** -3", 0.125],
      [power, [2, 10], "2 ** 10", 1024],
      [times, [-77, -14], "-77 * -14", 1078],
      [times, [0, 0], "0 * 0", 0],
      [times, [1, -14], "1 * -14", -14],
      [times, [33, 456789], "33 * 456789", 15074037],
    ];

    configs.forEach(([operatorFactory, inputs, code, output]): void => {
      const name = `${operatorFactory.name}: ${JSON.stringify(inputs)})`;

      it(name, function (): void {
        const operands = inputs.map((input): any => {
          switch (typeof input) {
            case "boolean":
              return bool.create((): number => (input ? 1 : 0));
            case "number":
              return constant.create((): number => input);
            default:
              throw new TypeError("No such terminal.");
          }
        });

        const operator = operatorFactory.create(operands as any);

        testCommon(operands.length as NonNegativeInteger, code, operator);
        expect(
          operator.run({}),
          "Unexpected value returned after code execution"
        ).to.equal(output);
      });
    });
  });
});
