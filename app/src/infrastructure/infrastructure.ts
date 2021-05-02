import { promisify } from "util";
import { readFile as readFileCallback } from "fs";

import { PriorityQueue } from "typescript-collections";

import { CurryLog } from "src/curry-log";

import {
  Formation,
  InfrastructureData,
  Itinerary,
  Path,
  Route,
  Station,
  Timetable,
  TimetableEntry,
  Train,
  Vehicle,
  Vertex,
} from "./types";

import { ParseInfrastructureXML, parseInfrastructure } from "./parser";
import { MapSet } from "../util";

const readFile = promisify(readFileCallback);

export const infrastructureFactory = {
  async buildFromFiles(
    this: unknown,
    log: CurryLog,
    paths: {
      courses: string;
      infrastructureOTML: string;
      infrastructureTrafIT: string;
      rollingStock: string;
      timetables: string;
    }
  ): Promise<Infrastructure> {
    const [
      courses,
      infrastructureOTML,
      infrastructureTrafIT,
      rollingStock,
      timetables,
    ] = await Promise.all([
      readFile(paths.courses, "utf-8"),
      readFile(paths.infrastructureOTML, "utf-8"),
      readFile(paths.infrastructureTrafIT, "utf-8"),
      readFile(paths.rollingStock, "utf-8"),
      readFile(paths.timetables, "utf-8"),
    ]);

    return infrastructureFactory.buildFromText(log, {
      courses,
      infrastructureOTML,
      infrastructureTrafIT,
      rollingStock,
      timetables,
    });
  },
  async buildFromText(
    this: unknown,
    log: CurryLog,
    xml: ParseInfrastructureXML
  ): Promise<Infrastructure> {
    const data = await parseInfrastructure(log, xml);
    return new Infrastructure(
      data.formations,
      data.itineraries,
      data.itinerariesLength,
      data.mainItineraries,
      data.paths,
      data.pathsLength,
      data.routes,
      data.routesLength,
      data.stations,
      data.timetables,
      data.trains,
      data.vehicles,
      data.vertexes
    );
  },
};

const kindToPropName = new Map([
  ["itinerary", "itineraries"],
  ["path", "paths"],
  ["route", "routes"],
  ["station", "stations"],
  ["timetable", "timetables"],
  ["train", "trains"],
  ["vertex", "vertexes"],
] as const);

export type CommonTimetableEntry = [TimetableEntry, TimetableEntry];

export class Infrastructure implements InfrastructureData {
  private readonly _vertexToRoutes = new MapSet<Vertex, Route>();

  public constructor(
    public readonly formations: ReadonlyMap<string, Formation>,
    public readonly itineraries: ReadonlyMap<string, Itinerary>,
    public readonly itinerariesLength: number,
    public readonly mainItineraries: ReadonlySet<Itinerary>,
    public readonly paths: ReadonlyMap<string, Path>,
    public readonly pathsLength: number,
    public readonly routes: ReadonlyMap<string, Route>,
    public readonly routesLength: number,
    public readonly stations: ReadonlyMap<string, Station>,
    public readonly timetables: ReadonlyMap<string, Timetable>,
    public readonly trains: ReadonlyMap<string, Train>,
    public readonly vehicles: ReadonlyMap<string, Vehicle>,
    public readonly vertexes: ReadonlyMap<string, Vertex>
  ) {
    for (const route of routes.values()) {
      this._vertexToRoutes.get(route.vertexes[0]).add(route);
    }
  }

  public getOrThrow(kind: "itinerary", key: string): Itinerary;
  public getOrThrow(kind: "path", key: string): Path;
  public getOrThrow(kind: "route", key: string): Route;
  public getOrThrow(kind: "station", key: string): Station;
  public getOrThrow(kind: "timetable", key: string): Timetable;
  public getOrThrow(kind: "train", key: string): Train;
  public getOrThrow(kind: "vertex", key: string): Vertex;
  public getOrThrow(
    kind: Parameters<typeof kindToPropName["get"]>[0],
    key: string
  ): unknown {
    const propName = kindToPropName.get(kind);
    if (propName == null) {
      throw new Error(`Invalid kind ${kind}.`);
    }

    const value = this[propName].get(key);
    if (value == null) {
      throw new Error(`Can't find ${kind} ${key}.`);
    }

    return value;
  }

  public getCommonTimetableEntries(
    fromStation: Station,
    timetable1: Timetable,
    timetable2: Timetable
  ): CommonTimetableEntry[] {
    const timetable1FirstEntryIndex = timetable1.entries.findIndex(
      (entry): boolean => entry.station === fromStation
    );
    const timetable2FirstEntryIndex = timetable2.entries.findIndex(
      (entry): boolean => entry.station === fromStation
    );

    if (timetable1FirstEntryIndex === -1 || timetable2FirstEntryIndex === -1) {
      return [];
    }

    const commonEntries: CommonTimetableEntry[] = [];
    for (
      let i1 = timetable1FirstEntryIndex, i2 = timetable2FirstEntryIndex;
      i1 < timetable1.entries.length && i2 < timetable1.entries.length;
      ++i1, ++i2
    ) {
      const entry1 = timetable1.entries[i1];
      const entry2 = timetable2.entries[i2];

      if (entry1.station !== entry2.station) {
        break;
      }

      commonEntries.push([entry1, entry2]);
    }

    return commonEntries;
  }

  public getTimetableDuration(
    train: Train,
    fromStation: Station,
    toStation: Station
  ): number | undefined {
    const fromStationEntry = train.timetable.entries.find(
      (entry): boolean => entry.station === fromStation
    );
    const toStationEntry = train.timetable.entries.find(
      (entry): boolean => entry.station === toStation
    );

    const departure = fromStationEntry?.departure ?? fromStationEntry?.arrival;
    const arrival = toStationEntry?.departure ?? toStationEntry?.arrival;

    if (typeof departure === "number" && typeof arrival === "number") {
      return arrival - departure;
    } else {
      return;
    }
  }

  public getTimetableReserve(
    timetable: Timetable,
    fromStation: Station,
    toStation: Station,
    inclusive = false
  ): number | undefined {
    const fromStationEntryIndex = timetable.entries.findIndex(
      (entry): boolean => entry.station === fromStation
    );
    const toStationEntryIndex = timetable.entries.findIndex(
      (entry): boolean => entry.station === toStation
    );

    if (fromStationEntryIndex === -1 || toStationEntryIndex === -1) {
      return;
    }

    const entries = inclusive
      ? timetable.entries.slice(
          fromStationEntryIndex, // Include first.
          toStationEntryIndex + 1 // Include last.
        )
      : timetable.entries.slice(
          fromStationEntryIndex + 1, // Exclude first.
          toStationEntryIndex // Exclude last.
        );

    return entries.reduce((acc, entry): number => {
      return acc + entry.plannedDwellTime - entry.minimalDwellTime;
    }, 0);
  }

  public getFastest(...trains: Train[]): Train {
    return trains.reduce((acc, train): Train => {
      return train.maxSpeed > acc.maxSpeed ? train : acc;
    }, trains[0]);
  }

  public getItineraryOffset(
    itinerary: Itinerary,
    routeID: string,
    offset: number
  ): number | undefined {
    const routeIndex = itinerary.routes.findIndex(
      (route): boolean => route.routeID === routeID
    );
    if (routeIndex === -1) {
      return;
    }

    return itinerary.routes
      .slice(0, routeIndex)
      .reduce((acc, route): number => {
        return acc + route.length;
      }, offset);
  }

  public getTrainsArrivalAtStation(
    train: Train,
    stationID: string
  ): number | undefined {
    return train.timetable.entries.find(
      (entry): boolean => entry.station.stationID === stationID
    )?.arrival;
  }

  public getTrainsDepartureFromStation(
    train: Train,
    stationID: string
  ): number | undefined {
    return train.timetable.entries.find(
      (entry): boolean => entry.station.stationID === stationID
    )?.departure;
  }

  public computeDistanceMap(
    allRoutes: Iterable<Route>,
    zeroRoutes: ReadonlySet<Route>
  ): Map<Route, number> {
    const routesByVertex = new MapSet<Vertex, Route>();
    for (const route of allRoutes) {
      routesByVertex.get(route.vertexes[route.vertexes.length - 1]).add(route);
    }

    const distanceMap = new Map<Route, number>();

    for (const route of zeroRoutes) {
      distanceMap.set(route, route.length);
    }

    type Item = {
      firstRoute: Route;
      length: number;
      routes: ReadonlySet<Route>;
    };
    const queue = new PriorityQueue<Item>(
      (a, b): number => a.length - b.length
    );
    for (const route of zeroRoutes.values()) {
      queue.enqueue({
        firstRoute: route,
        length: route.length,
        routes: new Set([route]),
      });
    }

    let item: Item | undefined;
    while ((item = queue.dequeue())) {
      const nextStartVertex = item.firstRoute.vertexes[0];
      const prevRoutes = routesByVertex.get(nextStartVertex);

      for (const prevRoute of prevRoutes) {
        if (item.routes.has(prevRoute)) {
          // This route has already been visited.
          continue;
        }

        const length = item.length + prevRoute.length;
        if (
          length >= (distanceMap.get(prevRoute) ?? Number.POSITIVE_INFINITY)
        ) {
          // Shorter way was already found.
          continue;
        }
        distanceMap.set(prevRoute, length);

        const routes = new Set([...item.routes, prevRoute]);

        queue.enqueue({
          firstRoute: prevRoute,
          length,
          routes,
        });
      }
    }

    return distanceMap;
  }
}
