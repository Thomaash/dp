export function prop<O, N extends keyof O>(name: N): (obj: O) => O[N] {
  return (obj: O): O[N] => obj[name];
}
