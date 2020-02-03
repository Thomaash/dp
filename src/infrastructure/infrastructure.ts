import { promisify } from "util";
import { readFile as readFileCallback } from "fs";

import { Course, InfrastructureData, Itinerary, Path, Route } from "./types";

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
      data.courses,
      data.itineraries,
      data.itinerariesLength,
      data.mainItineraries,
      data.paths,
      data.pathsLength,
      data.routes,
      data.routesLength
    );
  }
};

export class Infrastructure implements InfrastructureData {
  public constructor(
    public readonly courses: ReadonlyMap<string, Course>,
    public readonly itineraries: ReadonlyMap<string, Itinerary>,
    public readonly itinerariesLength: number,
    public readonly mainItineraries: ReadonlySet<Itinerary>,
    public readonly paths: ReadonlyMap<string, Path>,
    public readonly pathsLength: number,
    public readonly routes: ReadonlyMap<string, Route>,
    public readonly routesLength: number
  ) {}
}
