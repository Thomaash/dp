export class MapWithDefaultValueFactory<K, V> extends Map<K, V> {
  public constructor(private readonly _createDefaultValue: () => V) {
    super();
  }

  public get(key: K): V {
    if (this.has(key)) {
      return super.get(key)!;
    } else {
      const value = this._createDefaultValue();
      super.set(key, value);
      return value;
    }
  }
}

export class MapWithDefaultValue<K, V> extends Map<K, V> {
  public constructor(private readonly _default: V) {
    super();
  }

  public get(key: K): V {
    return this.has(key) ? super.get(key)! : this._default;
  }
}

export class MapOfSets<K, V> extends Map<K, Set<V>> {
  public constructor() {
    super();
  }

  public get(key: K): Set<V> {
    const existing = super.get(key);
    if (typeof existing !== "undefined") {
      return existing;
    } else {
      const newSet = new Set<V>();
      super.set(key, newSet);
      return newSet;
    }
  }
}
