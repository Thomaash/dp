import { promisify } from "util";
import { readFile as readFileCallback } from "fs";

import { Train, InfrastructureData, Itinerary, Path, Route } from "./types";

import { parseInfrastructure } from "./parser";

const readFile = promisify(readFileCallback);

export interface InfrastructureFactory {}

export const infrastructureFactory = {
  async buildFromFiles(
    this: unknown,
    paths: {
      courses: string;
      infrastructure: string;
    }
  ): Promise<Infrastructure> {
    const [courses, infrastructure] = await Promise.all([
      readFile(paths.courses, "utf-8"),
      readFile(paths.infrastructure, "utf-8")
    ]);

    return infrastructureFactory.buildFromText({
      courses,
      infrastructure
    });
  },
  async buildFromText(
    this: unknown,
    trafIT: {
      courses: string;
      infrastructure: string;
    }
  ): Promise<Infrastructure> {
    const data = await parseInfrastructure(trafIT);
    return new Infrastructure(
      data.itineraries,
      data.itinerariesLength,
      data.mainItineraries,
      data.paths,
      data.pathsLength,
      data.routes,
      data.routesLength,
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
    public readonly trains: ReadonlyMap<string, Train>
  ) {}

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
