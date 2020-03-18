export { MapWithDefaultValue, MapWithDefaultValueFactory } from "../util";

import { MapWithDefaultValue } from "../util";

export type Key = string | number | boolean | null;

export function ck(...rest: Key[]): string {
  return JSON.stringify(rest);
}

export interface BlockingEntry<
  Place extends Key = Key,
  Blocker extends Key = Key,
  Blocked extends Key = Key
> {
  place: Place;
  blocker: Blocker;
  blocked: Blocked;
}

export interface BlockingQuery<
  Place extends Key = Key,
  Blocker extends Key = Key,
  Blocked extends Key = Key
> {
  place?: Place;
  blocker?: Blocker;
  blocked?: Blocked;
}

export class Blocking<
  Place extends Key = Key,
  Blocker extends Key = Key,
  Blocked extends Key = Key
> {
  private _entries = new Map<string, BlockingEntry<Place, Blocker, Blocked>>();
  private _blockedBy = new MapWithDefaultValue<Blocked, number>(0);
  private _blockedAtPlace = new MapWithDefaultValue<Place, number>(0);

  private _queryEntries(
    query: BlockingQuery<Place, Blocker, Blocked>
  ): BlockingEntry<Place, Blocker, Blocked>[] {
    return [...this._entries.values()].filter(
      (entry): boolean =>
        (query.place == null || entry.place === query.place) &&
        (query.blocker == null || entry.blocker === query.blocker) &&
        (query.blocked == null || entry.blocked === query.blocked)
    );
  }

  public block(place: Place, blocker: Blocker, blocked: Blocked): this {
    const key = ck(place, blocker, blocked);

    // Do not register the same blocking multiple times.
    if (!this._entries.has(key)) {
      this._entries.set(key, Object.freeze({ place, blocker, blocked }));
      this._blockedBy.set(blocked, this._blockedBy.get(blocked) + 1);
      this._blockedAtPlace.set(place, this._blockedAtPlace.get(place) + 1);
    }

    return this;
  }

  public unblock(place: Place, blocker: Blocker, blocked: Blocked): this {
    const key = ck(place, blocker, blocked);

    // Do not unregister nonexistent blocking.
    if (this._entries.has(key)) {
      this._entries.delete(key);

      const blockedBy = this._blockedBy.get(blocked);
      if (blockedBy > 1) {
        this._blockedBy.set(blocked, this._blockedBy.get(blocked) - 1);
        this._blockedAtPlace.set(place, this._blockedAtPlace.get(place) - 1);
      } else {
        this._blockedBy.delete(blocked);
        this._blockedAtPlace.delete(place);
      }
    }

    return this;
  }

  public unblockAll(
    query: BlockingQuery<Place, Blocker, Blocked>
  ): BlockingEntry<Place, Blocker, Blocked>[] {
    return this._queryEntries(query).map(
      (blockingEntry): BlockingEntry<Place, Blocker, Blocked> => {
        this.unblock(
          blockingEntry.place,
          blockingEntry.blocker,
          blockingEntry.blocked
        );
        return blockingEntry;
      }
    );
  }

  public isBlocked(blocked: Blocked): boolean;
  public isBlocked(place: Place, blocker: Blocker, blocked: Blocked): boolean;
  public isBlocked(...rest: [Blocked] | [Place, Blocker, Blocked]): boolean {
    if (rest.length === 1) {
      const [blocked] = rest;
      return this._blockedBy.get(blocked) > 0;
    } else {
      const [place, blocker, blocked] = rest;
      return this._entries.has(ck(place, blocker, blocked));
    }
  }

  public isBlockedQuery(
    query: BlockingQuery<Place, Blocker, Blocked>
  ): boolean {
    for (const entry of this._entries.values()) {
      if (
        (query.place == null || entry.place === query.place) &&
        (query.blocker == null || entry.blocker === query.blocker) &&
        (query.blocked == null || entry.blocked === query.blocked)
      ) {
        return true;
      }
    }

    return false;
  }

  public getBlocked(
    query: BlockingQuery<Place, Blocker, Blocked>
  ): BlockingEntry<Place, Blocker, Blocked>[] {
    return this._queryEntries(query);
  }

  public countBlockedAtPlace(place: Place): number {
    return this._blockedAtPlace.get(place);
  }

  public dumpState(): void {
    const blockedByLines: string[] = [];
    for (const [blocked, numBlockedBy] of this._blockedBy) {
      blockedByLines.push(
        ["  ", blocked, " is blocked by ", numBlockedBy, " trains"].join("")
      );
    }
    blockedByLines.sort();
    console.info(["Blocked by:", ...blockedByLines, ""].join("\r\n"));

    const blockingEntryLines: string[] = [];
    for (const [, { place, blocker, blocked }] of this._entries) {
      blockingEntryLines.push(
        ["  ", place, ": ", blocked, " is blocked by ", blocker].join("")
      );
    }
    blockingEntryLines.sort();
    console.info(["Blocking entries:", ...blockingEntryLines, ""].join("\r\n"));
  }
}
