import { expect } from "chai";

import {
  Minus,
  Plus,
  Constant,
  RandomBipolarConstant
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

    expect(new Function(`"use strict"; return (${m1.code});`)()).to.equal(-4);
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
      .to.have.property("children")
      .that.has.lengthOf(2);
    expect(m1.children[0])
      .to.have.property("children")
      .that.has.lengthOf(2);
    expect(m1.children[1])
      .to.have.property("children")
      .that.has.lengthOf(2);

    // Same code.
    expect(m2)
      .to.have.property("code")
      .that.equals(m1.code);

    // Different instances.
    const a1: any = m1;
    const a2: any = m2;
    expect(a1).to.not.equal(a2);
    expect(a1.children).to.not.equal(a2.children);
    expect(a1.children[0]).to.not.equal(a2.children[0]);
    expect(a1.children[0].children[0]).to.not.equal(a2.children[0].children[0]);
    expect(a1.children[0].children[1]).to.not.equal(a2.children[0].children[1]);
    expect(a1.children[1]).to.not.equal(a2.children[1]);
    expect(a1.children[1].children[0]).to.not.equal(a2.children[1].children[0]);
    expect(a1.children[1].children[1]).to.not.equal(a2.children[1].children[1]);
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
});
