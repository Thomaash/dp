export function haveIntersection<V>(
  a: ReadonlySet<V>,
  b: ReadonlySet<V>
): boolean {
  for (const value of a.values()) {
    if (b.has(value)) {
      return true;
    }
  }

  return false;
}

export function intersection<V>(a: ReadonlySet<V>, b: ReadonlySet<V>): Set<V> {
  const intersection = new Set<V>();

  for (const value of a.values()) {
    if (b.has(value)) {
      intersection.add(value);
    }
  }

  return intersection;
}

export function findAnyIntersectionValue<V>(
  a: ReadonlySet<V>,
  b: ReadonlySet<unknown>
): V | undefined {
  for (const value of a.values()) {
    if (b.has(value)) {
      return value;
    }
  }
}
