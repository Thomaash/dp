import { InputConfig, Rng, Statement, Tuple, isOperator } from "../language";
import { xor4096 } from "seedrandom";

function getAllStatements<Inputs extends InputConfig>(
  root: Statement<Inputs>
): Statement<Inputs>[] {
  if (isOperator(root)) {
    const operands: readonly Statement<Inputs>[] = root.operands;
    return [
      root,
      ...([] as Statement<Inputs>[]).concat(
        ...operands.map((statement): Statement<Inputs>[] =>
          getAllStatements(statement)
        )
      ),
    ];
  } else {
    return [root];
  }
}

function pickRandomStatement<Inputs extends InputConfig>(
  root: Statement<Inputs>,
  rng: Rng
): Statement<Inputs> {
  const statements = getAllStatements(root);
  return statements[Math.floor(rng() * statements.length)];
}

function crossoverOperands<
  Inputs extends InputConfig,
  A extends number,
  B extends number
>(
  a: Tuple<Statement<Inputs>, A>,
  b: Tuple<Statement<Inputs>, B>,
  crossover: (
    a: Statement<Inputs>,
    b: Statement<Inputs>
  ) => [Statement<Inputs>, Statement<Inputs>]
): {
  a: Tuple<Statement<Inputs>, A>;
  b: Tuple<Statement<Inputs>, B>;
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
    a: (newA as readonly Statement<Inputs>[]) as Tuple<Statement<Inputs>, A>,
    b: (newB as readonly Statement<Inputs>[]) as Tuple<Statement<Inputs>, B>,
  };
}

export class PopulationCrossover<Inputs extends InputConfig> {
  private readonly _rng: Rng;

  public constructor(public readonly seed: string) {
    this._rng = xor4096(seed);
  }

  public subtree(
    a: Statement<Inputs>,
    b: Statement<Inputs>
  ): [Statement<Inputs>, Statement<Inputs>] {
    const swapA = pickRandomStatement(a, this._rng);
    const swapB = pickRandomStatement(b, this._rng);

    return [
      this._subtreeSwap(a, swapA, swapB),
      this._subtreeSwap(b, swapB, swapA),
    ];
  }

  public _subtreeSwap(
    root: Statement<Inputs>,
    original: Statement<Inputs>,
    replacement: Statement<Inputs>
  ): Statement<Inputs> {
    if (root === original) {
      return replacement;
    } else if (isOperator(root)) {
      return root.create(
        root.createOperandtuple(
          (_, i): Statement<Inputs> =>
            this._subtreeSwap(root.operands[i], original, replacement)
        )
      );
    } else {
      // A terminal encountered, nowhere else to go.
      return root;
    }
  }

  public simple(
    a: Statement<Inputs>,
    b: Statement<Inputs>
  ): [Statement<Inputs>, Statement<Inputs>] {
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
    a: Statement<Inputs>,
    b: Statement<Inputs>
  ): [Statement<Inputs>, Statement<Inputs>] {
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
