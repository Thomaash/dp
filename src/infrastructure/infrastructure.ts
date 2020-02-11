import { promisify } from "util";
import { readFile as readFileCallback } from "fs";

import {
  InfrastructureData,
  Itinerary,
  Path,
  Route,
  Station,
  Train
} from "./types";

import { parseInfrastructure } from "./parser";

const readFile = promisify(readFileCallback);

export interface InfrastructureFactory {}

export const infrastructureFactory = {
  async buildFromFiles(
    this: unknown,
    paths: {
      courses: string;
      infrastructure: string;
      rollingStock: string;
    }
  ): Promise<Infrastructure> {
    const [courses, infrastructure, rollingStock] = await Promise.all([
      readFile(paths.courses, "utf-8"),
      readFile(paths.infrastructure, "utf-8"),
      readFile(paths.rollingStock, "utf-8")
    ]);

    return infrastructureFactory.buildFromText({
      courses,
      infrastructure,
      rollingStock
    });
  },
  async buildFromText(
    this: unknown,
    xml: {
      courses: string;
      infrastructure: string;
      rollingStock: string;
    }
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
      data.trains
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
    public readonly trains: ReadonlyMap<string, Train>
  ) {}

  public getFastest(...trains: Train[]): Train {
    return trains.reduce((acc, train): Train => {
      return train.maxSpeed > acc.maxSpeed ? train : acc;
    }, trains[0]);
  }

  public getItineraryOffset(
    itinerary: Itinerary,
    routeID: string,
    offset: number
  ): number | null {
    const routeIndex = itinerary.routes.findIndex(
      (route): boolean => route.routeID === routeID
    );
    if (routeIndex === -1) {
      return null;
    }

    return itinerary.routes
      .slice(0, routeIndex)
      .reduce((acc, route): number => {
        return acc + route.length;
      }, offset);
  }
}
