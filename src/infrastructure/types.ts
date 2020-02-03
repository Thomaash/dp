export interface Route {
  readonly routeID: string;
  readonly length: number;
}

export interface Path {
  readonly pathID: string;
  readonly routes: readonly Route[];
  readonly length: number;
}

export interface Itinerary {
  readonly itineraryID: string;
  readonly paths: readonly Path[];
  readonly routes: readonly Route[];
  readonly length: number;
}

export interface Course {
  readonly courseID: string;
  readonly itineraries: readonly Itinerary[];
  readonly mainItinerary: Itinerary;
}

export interface InfrastructureData {
  readonly courses: ReadonlyMap<string, Course>;
  readonly itineraries: ReadonlyMap<string, Itinerary>;
  readonly itinerariesLength: number;
  readonly mainItineraries: ReadonlySet<Itinerary>;
  readonly paths: ReadonlyMap<string, Path>;
  readonly pathsLength: number;
  readonly routes: ReadonlyMap<string, Route>;
  readonly routesLength: number;
}
