import { expect } from "chai";

import {
  Minus,
  Plus,
  Constant,
  RandomBipolarConstant,
  And,
  Bool,
  Operator,
  PositiveInteger,
  Or,
  Not,
  Floor,
  Divide,
  Times,
  Power
} from "../../../src/ga/language";

describe("Language", function(): void {
  it("Code construction", function(): void {
    const c1 = new Constant(1);
    const c2 = new Constant(2);
    const c3 = new Constant(3);
    const c4 = new Constant(4);

    const p1 = new Plus(c1, c2);
    const p2 = new Plus(c3, c4);

    const m1 = new Minus(p1, p2);

    expect(c1)
      .to.have.property("code")
      .that.equals("1");
    expect(c2)
      .to.have.property("code")
      .that.equals("2");
    expect(c3)
      .to.have.property("code")
      .that.equals("3");
    expect(c4)
      .to.have.property("code")
      .that.equals("4");

    expect(p1)
      .to.have.property("code")
      .that.equals("1 + 2");
    expect(p2)
      .to.have.property("code")
      .that.equals("3 + 4");

    expect(m1)
      .to.have.property("code")
      .that.equals("1 + 2 - (3 + 4)");

    expect(m1)
      .to.have.property("run")
      .that.is.a("function");
    expect(m1.run()).to.equal(-4);
  });

  it("Cloning", function(): void {
    const c1 = new Constant(1);
    const c2 = new Constant(2);
    const c3 = new Constant(3);
    const c4 = new Constant(4);

    const p1 = new Plus(c1, c2);
    const p2 = new Plus(c3, c4);

    const m1 = new Minus(p1, p2);

    const m2 = m1.clone();

    // Same structure.
    expect(m1)
      .to.have.property("operands")
      .that.has.lengthOf(2);
    expect(m1.operands[0])
      .to.have.property("operands")
      .that.has.lengthOf(2);
    expect(m1.operands[1])
      .to.have.property("operands")
      .that.has.lengthOf(2);

    // Same code.
    expect(m2)
      .to.have.property("code")
      .that.equals(m1.code);

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

  it("Random Bipolar Constant", function(): void {
    const rbcs = new Array(1000).fill(null).map(
      (): RandomBipolarConstant => {
        return new RandomBipolarConstant();
      }
    );

    rbcs.forEach((rbc): void => {
      expect(rbc)
        .to.have.property("code")
        .that.is.a("string");
      expect(+rbc.code)
        .to.be.lessThan(1)
        .and.greaterThan(-1);
    });
  });

  describe("Operators", function(): void {
    const configs: [
      new (...operands: any[]) => Operator<PositiveInteger>,
      any[],
      string,
      any
    ][] = [
      // [Divide, [0, 0], "0 / 0", Number.NaN], // TODO
      [And, [false, false], "false && false", false],
      [And, [false, true], "false && true", false],
      [And, [true, false], "true && false", false],
      [And, [true, true], "true && true", true],
      [Divide, [-77, -11], "-77 / -11", 7],
      [Divide, [1, -16], "1 / -16", -0.0625],
      [Divide, [21, 7], "21 / 7", 3],
      [Floor, [-0.3], "Math.floor(-0.3)", -1],
      [Floor, [-0.5], "Math.floor(-0.5)", -1],
      [Floor, [-0.7], "Math.floor(-0.7)", -1],
      [Floor, [-1], "Math.floor(-1)", -1],
      [Floor, [0.3], "Math.floor(0.3)", 0],
      [Floor, [0.5], "Math.floor(0.5)", 0],
      [Floor, [0.7], "Math.floor(0.7)", 0],
      [Floor, [0], "Math.floor(0)", 0],
      [Floor, [1], "Math.floor(1)", 1],
      [Minus, [-77, -14], "-77 - -14", -63],
      [Minus, [0, 0], "0 - 0", 0],
      [Minus, [1, -14], "1 - -14", 15],
      [Minus, [33, 456789], "33 - 456789", -456756],
      [Not, [false], "!false", true],
      [Not, [true], "!true", false],
      [Or, [false, false], "false || false", false],
      [Or, [false, true], "false || true", true],
      [Or, [true, false], "true || false", true],
      [Or, [true, true], "true || true", true],
      [Plus, [-77, -14], "-77 + -14", -91],
      [Plus, [0, 0], "0 + 0", 0],
      [Plus, [1, -14], "1 + -14", -13],
      [Plus, [33, 456789], "33 + 456789", 456822],
      [Power, [-2, -3], "(-2) ** -3", -0.125],
      [Power, [-2, 10], "(-2) ** 10", 1024],
      [Power, [2, -3], "2 ** -3", 0.125],
      [Power, [2, 10], "2 ** 10", 1024],
      [Times, [-77, -14], "-77 * -14", 1078],
      [Times, [0, 0], "0 * 0", 0],
      [Times, [1, -14], "1 * -14", -14],
      [Times, [33, 456789], "33 * 456789", 15074037]
    ];

    configs.forEach(([Operator, inputs, code, output]): void => {
      it(`${Operator.name}: ${JSON.stringify(inputs)})`, function(): void {
        const operands = inputs.map((input): any => {
          switch (typeof input) {
            case "boolean":
              return new Bool(input);
            case "number":
              return new Constant(input);
            default:
              throw new TypeError("No such terminal.");
          }
        });

        const operator = new Operator(...(operands as any));

        expect(operator.code).to.equal(code);
        expect(operator.run()).to.equal(output);
      });
    });
  });
});
