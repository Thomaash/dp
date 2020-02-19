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
  Vertex
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
