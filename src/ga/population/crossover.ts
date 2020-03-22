import { Rng, Statement, Tuple, isOperator } from "../language";
import { xor4096 } from "seedrandom";

function crossoverOperands<A extends number, B extends number>(
  a: Tuple<Statement, A>,
  b: Tuple<Statement, B>,
  crossover: (a: Statement, b: Statement) => [Statement, Statement]
): {
  a: Tuple<Statement, A>;
  b: Tuple<Statement, B>;
} {
  const newA = a.slice();
  const newB = b.slice();

  const commonLength = Math.min(a.length, b.length);
  for (let i = 0; i < commonLength; ++i) {
    const afterCrossover = crossover(a[i], b[i]);
    newA[i] = afterCrossover[0];
    newB[i] = afterCrossover[1];
  }

  return {
    a: (newA as readonly Statement[]) as Tuple<Statement, A>,
    b: (newB as readonly Statement[]) as Tuple<Statement, B>,
  };
}

export class PopulationCrossover {
  private readonly _rng: Rng;

  public constructor(public readonly seed: string) {
    this._rng = xor4096(seed);
  }

  public simple(a: Statement, b: Statement): [Statement, Statement] {
    const commonHeight = Math.min(a.heightMin, b.heightMin);
    return commonHeight === 0
      ? // They have nothing in common, there's no way how to do a crossover.
        [b, a]
      : // A crossover can be done, pick some random height and swap the bottom
        // parts of the ASTs.
        this._simple(Math.floor(1 + this._rng() * (commonHeight - 1)), a, b);
  }

  public _simple(
    crossoverHeight: number,
    a: Statement,
    b: Statement
  ): [Statement, Statement] {
    if (crossoverHeight === 0) {
      return [b, a];
    } else if (isOperator(a) && isOperator(b)) {
      const operandsAfterCrossover = crossoverOperands(
        a.operands,
        b.operands,
        this._simple.bind(this, crossoverHeight - 1)
      );

      return [
        a.create(operandsAfterCrossover.a),
        b.create(operandsAfterCrossover.b),
      ];
    } else {
      // Some terminal encountered, nowhere else to go.
      return [a, b];
    }
  }
}
