import type * as tf from "@tensorflow/tfjs";
import { util } from "@tensorflow/tfjs";

export interface TensorDataJSON2D {
  dType: tf.DataType;
  labels: string[];
  shape: [number, number];
  x: number[][];
  y: number[];
}

export function normalize1D(raw: readonly number[]): number[] {
  const min = raw.reduce<number>(
    (acc, val): number => Math.min(acc, val),
    Number.POSITIVE_INFINITY
  );
  const zeroOffset = raw.map((v): number => v - min);
  const max = zeroOffset.reduce<number>(
    (acc, val): number => Math.max(acc, val),
    Number.NEGATIVE_INFINITY
  );
  const zeroToOne =
    max === 0 ? raw.map((v): number => v) : raw.map((v): number => v / max);
  const normalized = zeroToOne.map((v): number => v * 2 - 1);

  return normalized;
}

export function normalize2D(raw: readonly number[][]): number[][] {
  const min = raw.reduce<number>(
    (acc, val): number => Math.min(acc, ...val),
    Number.POSITIVE_INFINITY
  );
  const zeroOffset = raw.map((vs): number[] => vs.map((v): number => v - min));
  const max = zeroOffset.reduce<number>(
    (acc, val): number => Math.max(acc, ...val),
    Number.NEGATIVE_INFINITY
  );
  const zeroToOne =
    max === 0
      ? raw.map((vs): number[] => vs.map((v): number => v))
      : raw.map((vs): number[] => vs.map((v): number => v / max));
  const normalized = zeroToOne.map((vs): number[] =>
    vs.map((v): number => v * 2 - 1)
  );

  return normalized;
}

export function split<T>(
  array: T[],
  aShare: number,
  bShare: number
): [T[], T[]] {
  const shareSum = aShare + bShare;
  return array.reduce<[T[], T[]]>(
    (acc, value, i): [T[], T[]] => {
      acc[i % shareSum < aShare ? 0 : 1].push(value);
      return acc;
    },
    [[], []]
  );
}

export function shuffle<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  util.shuffle(shuffled);
  return shuffled;
}
