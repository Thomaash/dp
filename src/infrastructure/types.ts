export interface ItineraryArgs {
  overtaking: boolean;
}

export interface Route {
  readonly length: number;
  readonly routeID: string;
}

export interface Path {
  readonly length: number;
  readonly pathID: string;
  readonly routes: readonly Route[];
}

export interface Itinerary {
  readonly args: ItineraryArgs;
  readonly itineraryID: string;
  readonly length: number;
  readonly paths: readonly Path[];
  readonly routes: readonly Route[];
}

export interface Train {
  readonly itineraries: readonly Itinerary[];
  readonly mainItinerary: Itinerary;
  readonly maxSpeed: number;
  readonly paths: ReadonlySet<Path>;
  readonly routes: ReadonlySet<Route>;
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
  readonly trains: ReadonlyMap<string, Train>;
}
