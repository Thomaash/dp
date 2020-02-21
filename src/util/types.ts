export type RW<T> = T extends ReadonlySet<infer V>
  ? Set<V>
  : T extends ReadonlyMap<infer K, infer V>
  ? Map<K, V>
  : T extends (infer E)[]
  ? E[]
  : T extends Function
  ? T
  : T extends object
  ? {
      -readonly [P in keyof T]: RW<T[P]>;
    }
  : T;

export type RO<T> = T extends Set<infer V>
  ? ReadonlySet<V>
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<K, V>
  : T extends (infer E)[]
  ? readonly E[]
  : T extends Function
  ? T
  : T extends object
  ? {
      readonly [P in keyof T]: RO<T[P]>;
    }
  : T;
