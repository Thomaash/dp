import { xor4096 } from "seedrandom";
import snapshot from "snap-shot-it";

import {
  createAnd,
  createBipolarConstant,
  createBool,
  createCeil,
  createConstant,
  createDivide,
  createEquals,
  createFloor,
  createIfElse,
  createInput,
  createIntegerConstant,
  createMinus,
  createNot,
  createOr,
  createPlus,
  createPower,
  createRound,
  createSmallIntegerConstant,
  createTimes,
  createWeakEquals,
} from "../../../src/ga/language";

describe("Language", function (): void {
  it("Logic", function (): void {
    interface Inputs {
      a: boolean;
      b: boolean;
      c: boolean;
      d: boolean;
      e: boolean;
      f: boolean;
    }
    const inputs = {
      a: Boolean,
      b: Boolean,
      c: Boolean,
      d: Boolean,
      e: Boolean,
      f: Boolean,
    };

    const bool = createBool<Inputs>(inputs);
    const input = createInput<Inputs>(inputs);

    const and = createAnd<Inputs>(inputs);
    const equals = createEquals<Inputs>(inputs);
    const ifElse = createIfElse<Inputs>(inputs);
    const not = createNot<Inputs>(inputs);
    const or = createOr<Inputs>(inputs);
    const weakEquals = createWeakEquals<Inputs>(inputs);

    const rng = xor4096("TEST");
    snapshot(
      or.create([
        and.create([input.create(rng), bool.create(rng)]),
        weakEquals.create([
          equals.create([bool.create(rng), input.create(rng)]),
          ifElse.create([
            not.create([input.create(rng)]),
            bool.create(rng),
            not.create([input.create(rng)]),
          ]),
        ]),
      ]).code
    );
  });

  it("Math", function (): void {
    interface Inputs {
      a: number;
      b: number;
      c: number;
      d: number;
      e: number;
      f: number;
    }
    const inputs = {
      a: Number,
      b: Number,
      c: Number,
      d: Number,
      e: Number,
      f: Number,
    };

    const bipolarConstant = createBipolarConstant<Inputs>(inputs);
    const constant = createConstant<Inputs>(inputs);
    const input = createInput<Inputs>(inputs);
    const integerConstant = createIntegerConstant<Inputs>(inputs);
    const smallIntegerConstant = createSmallIntegerConstant<Inputs>(inputs);

    const ceil = createCeil<Inputs>(inputs);
    const divide = createDivide<Inputs>(inputs);
    const floor = createFloor<Inputs>(inputs);
    const minus = createMinus<Inputs>(inputs);
    const plus = createPlus<Inputs>(inputs);
    const power = createPower<Inputs>(inputs);
    const round = createRound<Inputs>(inputs);
    const times = createTimes<Inputs>(inputs);

    const rng = xor4096("TEST");
    snapshot(
      divide.create([
        plus.create([input.create(rng), constant.create(rng)]),
        times.create([
          minus.create([
            integerConstant.create(rng),
            round.create([input.create(rng)]),
          ]),
          power.create([
            floor.create([input.create(rng)]),
            ceil.create([
              power.create([
                smallIntegerConstant.create(rng),
                bipolarConstant.create(rng),
              ]),
            ]),
          ]),
        ]),
      ]).code
    );
  });
});
