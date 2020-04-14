import { CurryLog } from "../curry-log";
import { MapCounter } from "../util";

export { MapWithDefaultValue, MapWithDefaultValueFactory } from "../util";

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
  private _blockedBy = new MapCounter<Blocked>();
  private _blockedAtPlace = new MapCounter<Place>();

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

  public constructor(private readonly _log: CurryLog) {}

  public block(place: Place, blocker: Blocker, blocked: Blocked): this {
    const key = ck(place, blocker, blocked);

    // Do not register the same blocking multiple times.
    if (!this._entries.has(key)) {
      this._entries.set(key, Object.freeze({ place, blocker, blocked }));
      this._blockedBy.get(blocked).inc();
      this._blockedAtPlace.get(place).inc();
    }

    return this;
  }

  public unblock(place: Place, blocker: Blocker, blocked: Blocked): this {
    const key = ck(place, blocker, blocked);

    // Do not unregister nonexistent blocking.
    if (this._entries.has(key)) {
      this._entries.delete(key);

      this._blockedBy.get(blocked).dec();
      this._blockedAtPlace.get(place).dec();
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
      return this._blockedBy.get(blocked).get() > 0;
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
    return this._blockedAtPlace.get(place).get();
  }

  public dumpState(): void {
    const blockedByLines: string[] = [];
    for (const [blocked, blockedBy] of this._blockedBy) {
      blockedByLines.push(
        ["  ", blocked, " is blocked by ", blockedBy.get(), " trains"].join("")
      );
    }
    blockedByLines.sort();

    const blockingEntryLines: string[] = [];
    for (const [, { place, blocker, blocked }] of this._entries) {
      blockingEntryLines.push(
        ["  ", place, ": ", blocked, " is blocked by ", blocker].join("")
      );
    }
    blockingEntryLines.sort();

    this._log.info(
      [
        "Blocked by:",
        ...blockedByLines,
        "",
        "Blocking entries:",
        ...blockingEntryLines,
      ].join("\n")
    );
  }
}
