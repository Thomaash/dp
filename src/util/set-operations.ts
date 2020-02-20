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
