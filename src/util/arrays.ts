export function getConsecutivePairs<T>(array: readonly T[]): [T, T][] {
  const pairs: [T, T][] = [];

  for (let i = 1; i < array.length; ++i) {
    pairs.push([array[i - 1], array[i]]);
  }

  return pairs;
}
