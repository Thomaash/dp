export interface ItineraryArgs {
  readonly overtaking: boolean;
}

export interface TimetableEntry {
  readonly arrival?: number;
  readonly departure?: number;
  readonly station: Station;
  readonly type: "pass" | "stop";
}

export interface Timetable {
  readonly trainID: string;
  readonly entries: TimetableEntry[];
}

export interface Station {
  readonly stationID: string;
}

export interface Route {
  readonly length: number;
  readonly routeID: string;
  readonly stations: readonly Station[];
}

export interface Path {
  readonly length: number;
  readonly pathID: string;
  readonly routes: readonly Route[];
  readonly stations: readonly Station[];
}

export interface Itinerary {
  readonly args: ItineraryArgs;
  readonly itineraryID: string;
  readonly length: number;
  readonly paths: readonly Path[];
  readonly routes: readonly Route[];
  readonly stations: readonly Station[];
}

export interface Train {
  readonly itineraries: readonly Itinerary[];
  readonly mainItinerary: Itinerary;
  readonly maxSpeed: number;
  readonly paths: ReadonlySet<Path>;
  readonly routes: ReadonlySet<Route>;
  readonly timetable: Timetable;
  readonly trainID: string;
}

export interface InfrastructureData {
  readonly itineraries: ReadonlyMap<string, Itinerary>;
  readonly itinerariesLength: number;
  readonly mainItineraries: ReadonlySet<Itinerary>;
  readonly paths: ReadonlyMap<string, Path>;
  readonly pathsLength: number;
  readonly routes: ReadonlyMap<string, Route>;
  readonly routesLength: number;
  readonly stations: ReadonlyMap<string, Station>;
  readonly timetables: ReadonlyMap<string, Timetable>;
  readonly trains: ReadonlyMap<string, Train>;
}
