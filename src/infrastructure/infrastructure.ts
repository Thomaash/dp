import { promisify } from "util";
import { readFile as readFileCallback } from "fs";

import {
  InfrastructureData,
  Itinerary,
  Path,
  Route,
  Station,
  Train,
  Timetable,
  Vertex,
  TimetableEntry
} from "./types";

import { parseInfrastructure, ParseInfrastructureXML } from "./parser";

const readFile = promisify(readFileCallback);

export const infrastructureFactory = {
  async buildFromFiles(
    this: unknown,
    paths: {
      courses: string;
      infrastructure: string;
      rollingStock: string;
      timetables: string;
    }
  ): Promise<Infrastructure> {
    const [
      courses,
      infrastructure,
      rollingStock,
      timetables
    ] = await Promise.all([
      readFile(paths.courses, "utf-8"),
      readFile(paths.infrastructure, "utf-8"),
      readFile(paths.rollingStock, "utf-8"),
      readFile(paths.timetables, "utf-8")
    ]);

    return infrastructureFactory.buildFromText({
      courses,
      infrastructure,
      rollingStock,
      timetables
    });
  },
  async buildFromText(
    this: unknown,
    xml: ParseInfrastructureXML
  ): Promise<Infrastructure> {
    const data = await parseInfrastructure(xml);
    return new Infrastructure(
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
      data.vertexes
    );
  }
};

const kindToPropName = new Map([
  ["itinerary", "itineraries"],
  ["path", "paths"],
  ["route", "routes"],
  ["station", "stations"],
  ["timetable", "timetables"],
  ["train", "trains"],
  ["vertex", "vertexes"]
] as const);

export type CommonTimetableEntry = [TimetableEntry, TimetableEntry];

export class Infrastructure implements InfrastructureData {
  public constructor(
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
    public readonly vertexes: ReadonlyMap<string, Vertex>
  ) {}

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
}
