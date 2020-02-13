export function ck(...rest: string[]): string {
  return JSON.stringify(rest);
}

export class MWD<K, V> extends Map<K, V> {
  public gwd(key: K, defaultValue: V): V {
    if (this.has(key)) {
      return this.get(key)!;
    } else {
      this.set(key, defaultValue);
      return defaultValue;
    }
  }
}

export class Blocking<V> {
  private _data = new MWD<string, Set<V>>();

  public block(stationID: string, blockerID: string, blocked: V): this {
    const key = ck(stationID, blockerID);
    this._data.gwd(key, new Set()).add(blocked);

    return this;
  }

  public unblock(stationID: string, blockerID: string, blocked: V): this {
    const key = ck(stationID, blockerID);
    this._data.gwd(key, new Set()).delete(blocked);

    return this;
  }

  public unblockAll(stationID: string, blockerID: string): this {
    const key = ck(stationID, blockerID);
    this._data.delete(key);

    return this;
  }

  public isBlocked(tested: V): boolean {
    for (const set of this._data.values()) {
      if (set.has(tested)) {
        return true;
      }
    }

    return false;
  }

  public getBlocked(stationID: string, blockerID: string): V[] {
    const key = ck(stationID, blockerID);
    return [...this._data.gwd(key, new Set()).values()];
  }
}
