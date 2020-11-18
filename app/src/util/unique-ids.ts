export function createIDGenerator(prefix: string): () => string {
  let nm = 0;
  return (): string => prefix + ++nm;
}
