import { Rng, Statement, Tuple, isOperator } from "../language";
import { xor4096 } from "seedrandom";

function getAllStatements(root: Statement): Statement[] {
  if (isOperator(root)) {
    const operands: readonly Statement[] = root.operands;
    return [
      root,
      ...([] as Statement[]).concat(
        ...operands.map((statement): Statement[] => getAllStatements(statement))
      ),
    ];
  } else {
    return [root];
  }
}

function pickRandomStatement(root: Statement, rng: Rng): Statement {
  const statements = getAllStatements(root);
  return statements[Math.floor(rng() * statements.length)];
}

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

  // TODO: Test this!
  public subtree(a: Statement, b: Statement): [Statement, Statement] {
    const swapA = pickRandomStatement(a, this._rng);
    const swapB = pickRandomStatement(b, this._rng);

    return [
      this._subtreeSwap(a, swapA, swapB),
      this._subtreeSwap(b, swapB, swapA),
    ];
  }

  public _subtreeSwap(
    root: Statement,
    original: Statement,
    replacement: Statement
  ): Statement {
    if (root === original) {
      return replacement;
    } else if (isOperator(root)) {
      return root.create(
        root.createOperandtuple(
          (_, i): Statement =>
            this._subtreeSwap(root.operands[i], original, replacement)
        )
      );
    } else {
      // A terminal encountered, nowhere else to go.
      return root;
    }
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
