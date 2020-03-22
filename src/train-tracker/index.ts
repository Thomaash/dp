import { EventPayloads, OTAPI } from "../otapi";
import { Infrastructure, Route, Station, Train } from "../infrastructure";
import { MapSet, haveIntersection, MapMap } from "../util";
import { Bug } from "../util";

export type Report = EventPayloads["trainPositionReport"];

export interface TrainPositionInArea {
  train: Train;
  position: number;
}

export type TrainHandler = (payload: {
  train: Train;
  route: Route;
  time: number;
}) => void;

export interface Area {
  readonly areaID: string;
  readonly entryRoutes: ReadonlySet<Route>;
  readonly exitRoutes: ReadonlySet<Route>;
  readonly routes: ReadonlySet<Route>;
}

export class TrainTracker {
  private readonly _cleanupCallbacks: (() => void)[] = [];

  private readonly _areasByEntryRoute = new MapSet<Route, Area>();
  private readonly _areasByRoute = new MapSet<Route, Area>();
  private readonly _areasByExitRoute = new MapSet<Route, Area>();

  private readonly _areas = new Set<Area>();
  private readonly _distancesToEnd = new MapMap<Area, Route, number>();

  private readonly _lastRoutes = new Map<Train, Route>();
  private readonly _lastStations = new Map<Train, Station>();
  private readonly _reports = new Map<Train, Report>();
  private readonly _trainRoutes = new MapSet<Train, Route>();

  private readonly _trainsInArea = new MapSet<Area, Train>();

  private readonly _listeners = {
    "train-entered-area": new MapSet<Area, TrainHandler>(),
    "train-left-area": new MapSet<Area, TrainHandler>(),
  };

  public get size(): number {
    return this._reports.size;
  }

  public get trainIDs(): string[] {
    return [...this._reports.values()].map((train): string => train.trainID);
  }

  public constructor(
    private readonly _otapi: OTAPI,
    private readonly _infrastructure: Infrastructure,
    areas: Iterable<Area> = []
  ) {
    for (const area of areas) {
      this._areas.add(area);

      this._distancesToEnd.set(
        area,
        this._infrastructure.computeDistanceMap(area.routes, area.exitRoutes)
      );

      for (const route of area.entryRoutes) {
        this._areasByEntryRoute.get(route).add(area);
      }
      for (const route of area.routes) {
        this._areasByRoute.get(route).add(area);
      }
      for (const route of area.exitRoutes) {
        this._areasByExitRoute.get(route).add(area);
      }
    }
  }

  public getReport(train: Train | string): Report | undefined {
    return this._reports.get(
      typeof train === "string"
        ? this._infrastructure.getOrThrow("train", train)
        : train
    );
  }

  public getTrainsLastStation(train: Train | string): Station | undefined {
    return this._lastStations.get(
      typeof train === "string"
        ? this._infrastructure.getOrThrow("train", train)
        : train
    );
  }

  public getTrainsRoutes(train: Train | string): ReadonlySet<Route> {
    return this._trainRoutes.get(
      typeof train === "string"
        ? this._infrastructure.getOrThrow("train", train)
        : train
    );
  }

  public getDelay(train: Train | string): number {
    return this.getReport(train)?.delay ?? 0;
  }

  /**
   * The trains are sorted so that the train that is closest to the end of the
   * area is first.
   *
   * @remarks
   * The position is from the end of the area.
   */
  public getTrainsInAreaInOrder(area: Area): TrainPositionInArea[] {
    if (!this._areas.has(area)) {
      throw new Error(`Unknown area ${area.areaID}.`);
    }

    return [...this._trainsInArea.get(area).values()]
      .map(
        (train): TrainPositionInArea => {
          const report = this._reports.get(train);

          const route = this._lastRoutes.get(train);
          if (route == null) {
            throw new Bug(`Couldn't find last route of ${train.trainID}. `);
          }

          // The reports arrive with some delay. It's possible we don't have any
          // or that the report we do have is not on the itinerary yet. If the
          // train is on this itinerary but we don't have a report yet assume
          // it's at the very beginning.
          const routeOffset =
            report && report.routeID === route.routeID ? report.routeOffset : 0;

          const distanceToEnd = this._distancesToEnd.get(area).get(route);

          // If the train can't get to any exit route of the area it is assumed
          // it already reached a point where it will leave the area soon.
          const position =
            distanceToEnd == null ? 0 : distanceToEnd - routeOffset;

          return {
            train,
            position,
          };
        }
      )
      .sort((a, b): number => a.position - b.position);
  }

  public getTrainsInArea(area: Area): Train[] {
    return [...this._trainsInArea.get(area).values()];
  }

  /**
   * @returns The distance in meters from the start of the itinerary or
   * undefined if the train is not on it's main itinerary.
   */
  public getTrainPositionOnMainItinerary(trainID: string): number | undefined {
    const train = this._infrastructure.getOrThrow("train", trainID);
    const report = this._reports.get(train);
    if (report == null) {
      throw new Error(`There's no report available for ${trainID}.`);
    }

    return this._infrastructure.getItineraryOffset(
      train.mainItinerary,
      report.routeID,
      report.routeOffset
    );
  }

  /**
   * @returns The distance in meters between the trains (negative means that the
   * second train is in front of the first) or null in case they don't share
   * main itinerary or at least one of them is not on it's main itinerary.
   */
  public getDistanceBetweenTrains(
    firstTrainID: string,
    secondTrainID: string
  ): number | null {
    const firstTrain = this._infrastructure.trains.get(firstTrainID);
    if (firstTrain == null) {
      throw new Error(`There's no train called ${firstTrainID}.`);
    }

    const secondTrain = this._infrastructure.trains.get(secondTrainID);
    if (secondTrain == null) {
      throw new Error(`There's no train called ${secondTrainID}.`);
    }

    if (firstTrain.mainItinerary !== secondTrain.mainItinerary) {
      return null;
    }

    const firstTrainPosition = this.getTrainPositionOnMainItinerary(
      firstTrainID
    );
    if (firstTrainPosition == null) {
      return null;
    }

    const secondTrainPosition = this.getTrainPositionOnMainItinerary(
      secondTrainID
    );
    if (secondTrainPosition == null) {
      return null;
    }

    return secondTrainPosition - firstTrainPosition;
  }

  public startTracking(frequency: number): this {
    this._cleanupCallbacks.push(
      this._otapi.on(
        "trainCreated",
        this._handleTrainCreated.bind(this, frequency)
      ),
      this._otapi.on("trainDeleted", this._handleTrainDeleted.bind(this)),

      this._otapi.on(
        "trainPositionReport",
        this._handleTrainPositionReport.bind(this)
      ),

      this._otapi.on("trainArrival", this._handleTrainPass.bind(this)),
      this._otapi.on("trainDeparture", this._handleTrainPass.bind(this)),
      this._otapi.on("trainPass", this._handleTrainPass.bind(this)),

      this._otapi.on("routeEntry", this._handleRouteEntry.bind(this)),
      this._otapi.on("routeExit", this._handleRouteExit.bind(this))
    );

    return this;
  }

  public stopTraking(): this {
    this._cleanupCallbacks
      .splice(0)
      .forEach((callback): void => void callback());

    return this;
  }

  public on(
    eventName: "train-entered-area" | "train-left-area",
    area: Area,
    handler: TrainHandler
  ): () => void {
    if (!this._areas.has(area)) {
      throw new Error("No such area.");
    }

    this._listeners[eventName].get(area).add(handler);

    return (): void => {
      this._listeners[eventName].get(area).delete(handler);
    };
  }

  public _emit(
    eventName: "train-entered-area" | "train-left-area",
    area: Area,
    train: Train,
    route: Route,
    time: number
  ): void {
    for (const handler of this._listeners[eventName].get(area).values()) {
      handler({ train, route, time });
    }
  }

  private _enterArea(
    train: Train,
    area: Area,
    route: Route,
    time: number
  ): () => void {
    this._trainsInArea.get(area).add(train);

    return (): void => {
      this._emit("train-entered-area", area, train, route, time);
    };
  }

  private _leaveArea(
    train: Train,
    area: Area,
    route: Route,
    time: number
  ): () => void {
    this._trainsInArea.get(area).delete(train);

    return (): void => {
      this._emit("train-left-area", area, train, route, time);
    };
  }

  private _handleTrainCreated(
    frequency: number,
    _name: string,
    { trainID }: EventPayloads["trainCreated"]
  ): void {
    this._otapi
      .setSendPositionReports({ trainID, flag: true, time: frequency })
      .catch(
        console.error.bind(
          console,
          `Failed to request position reports for ${trainID}.`
        )
      );
  }

  private _handleTrainPass(
    _name: string,
    report:
      | EventPayloads["trainArrival"]
      | EventPayloads["trainDeparture"]
      | EventPayloads["trainPass"]
  ): void {
    const station = this._infrastructure.getOrThrow(
      "station",
      report.stationID
    );
    const train = this._infrastructure.getOrThrow("train", report.trainID);

    this._lastStations.set(train, station);
  }

  private _handleTrainPositionReport(
    _name: string,
    newReport: EventPayloads["trainPositionReport"]
  ): void {
    const train = this._infrastructure.getOrThrow("train", newReport.trainID);
    this._reports.set(train, newReport);
  }

  private _handleRouteEntry(
    _name: string,
    { trainID, routeID, time }: EventPayloads["routeEntry"]
  ): void {
    const emits: (() => void)[] = [];

    const route = this._infrastructure.getOrThrow("route", routeID);
    const train = this._infrastructure.getOrThrow("train", trainID);

    this._lastRoutes.set(train, route);
    this._trainRoutes.get(train).add(route);

    for (const area of this._areasByEntryRoute.get(route)) {
      if (!this._trainsInArea.get(area).has(train)) {
        emits.push(this._enterArea(train, area, route, time));
      }
    }

    for (const emit of emits) {
      emit();
    }
  }

  private _handleRouteExit(
    _name: string,
    { trainID, routeID, time }: EventPayloads["routeExit"]
  ): void {
    const emits: (() => void)[] = [];

    const route = this._infrastructure.getOrThrow("route", routeID);
    const train = this._infrastructure.getOrThrow("train", trainID);

    const trainRoutes = this._trainRoutes.get(train);
    trainRoutes.delete(route);

    for (const area of this._areasByRoute.get(route)) {
      if (haveIntersection(trainRoutes, area.routes)) {
        continue;
      }

      if (this._trainsInArea.get(area).has(train)) {
        emits.push(this._leaveArea(train, area, route, time));
      }
    }

    for (const emit of emits) {
      emit();
    }
  }

  private _handleTrainDeleted(
    _name: string,
    { trainID }: EventPayloads["trainDeleted"]
  ): void {
    const train = this._infrastructure.getOrThrow("train", trainID);

    this._lastRoutes.delete(train);
    this._lastStations.delete(train);
    this._reports.delete(train);
    this._trainRoutes.delete(train);

    for (const trains of this._trainsInArea.values()) {
      trains.delete(train);
    }
  }
}
