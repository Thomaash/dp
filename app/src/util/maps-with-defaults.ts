export class Counter {
  public constructor(private _count = 0) {}

  public inc(): this {
    ++this._count;
    return this;
  }
  public dec(): this {
    --this._count;
    return this;
  }
  public get(): number {
    return this._count;
  }
}

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

  public dropEmpty(): void {
    for (const [key, value] of this.entries()) {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          this.delete(key);
        }
      } else if (value instanceof Map || value instanceof Set) {
        if (value.size === 0) {
          this.delete(key);
        }
      } else if (value instanceof Counter) {
        if (value.get() === 0) {
          this.delete(key);
        }
      }
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

export class MapArray<K, V> extends Map<K, V[]> {
  public constructor() {
    super();
  }

  public get(key: K): V[] {
    const existing = super.get(key);
    if (typeof existing !== "undefined") {
      return existing;
    } else {
      const newArray: V[] = [];
      super.set(key, newArray);
      return newArray;
    }
  }
}

export class MapSet<K, V> extends Map<K, Set<V>> {
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

export class MapMapSet<K1, K2, V> extends Map<K1, MapSet<K2, V>> {
  public constructor() {
    super();
  }

  public get(key: K1): MapSet<K2, V> {
    const existing = super.get(key);
    if (typeof existing !== "undefined") {
      return existing;
    } else {
      const newSet = new MapSet<K2, V>();
      super.set(key, newSet);
      return newSet;
    }
  }
}

export class MapMap<K1, K2, V> extends Map<K1, Map<K2, V>> {
  public constructor() {
    super();
  }

  public get(key: K1): Map<K2, V> {
    const existing = super.get(key);
    if (typeof existing !== "undefined") {
      return existing;
    } else {
      const newMap = new Map<K2, V>();
      super.set(key, newMap);
      return newMap;
    }
  }
}

export class MapCounter<K> extends MapWithDefaultValueFactory<K, Counter> {
  public constructor(keys: Iterable<K> = []) {
    super((): Counter => new Counter(0));

    for (const key of keys) {
      this.get(key).inc();
    }
  }
}
