export function getConsecutivePairs<T>(array: readonly T[]): [T, T][] {
  const pairs: [T, T][] = [];

  for (let i = 1; i < array.length; ++i) {
    pairs.push([array[i - 1], array[i]]);
  }

  return pairs;
}

export function getAllCombinations<T>(array: readonly T[]): [T, T][] {
  const pairs: [T, T][] = [];

  for (const a of array) {
    for (const b of array) {
      if (a !== b) {
        pairs.push([a, b]);
      }
    }
  }

  return pairs;
}

export function getAllOvertakingCandidates<T>(array: readonly T[]): [T, T][] {
  const pairs: [T, T][] = [];

  for (let iA = 0; iA < array.length; ++iA) {
    for (let iB = iA + 1; iB < array.length; ++iB) {
      pairs.push([array[iA], array[iB]]);
    }
  }

  return pairs;
}
