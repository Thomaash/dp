import { EventPayloads, OTAPI } from "../otapi";
import { Infrastructure, Route, Station, Train } from "../infrastructure";
import { CurryLog, curryLog } from "../curry-log";
import { MapArray, MapMap, MapSet, haveIntersection } from "../util";
import { Bug } from "../util";

export type Report = EventPayloads["trainPositionReport"];

export interface TrainPositionInArea {
  train: Train;
  position: number;
}

export type TrainTrackerListeners = {
  [Name in keyof TrainTrackerEvents]: (
    payload: TrainTrackerEvents[Name]
  ) => void;
};

export interface Area {
  readonly areaID: string;
  readonly entryRoutes: ReadonlySet<Route>;
  readonly exitRoutes: ReadonlySet<Route>;
  readonly routes: ReadonlySet<Route>;
}

interface SingletonData {
  infrastructure: Infrastructure;
  otapi: OTAPI;
  singleton: TrainTracker;
  areas: Iterable<Area>;
}

export interface TrainTrackerAreaEvents {
  "train-entered-area": {
    train: Train;
    route: Route;
    time: number;
  };
  "train-left-area": {
    train: Train;
    route: Route;
    time: number;
  };
}
export interface TrainTrackerOtherEvents {
  "train-reserved-route": {
    train: Train;
    route: Route;
    time: number;
  };
  "train-released-route": {
    train: Train;
    route: Route;
    time: number;
  };
}
export interface TrainTrackerEvents
  extends TrainTrackerAreaEvents,
    TrainTrackerOtherEvents {}

export class TrainTracker {
  private readonly _cleanupCallbacks: (() => void)[] = [];

  private readonly _areasByEntryRoute = new MapSet<Route, Area>();
  private readonly _areasByRoute = new MapSet<Route, Area>();
  private readonly _areasByExitRoute = new MapSet<Route, Area>();

  private readonly _areas = new Set<Area>();
  private readonly _distancesToEnd = new MapMap<Area, Route, number>();

  private readonly _firstStopReports = new Map<Train, Report>();
  private readonly _lastRoutes = new Map<Train, Route>();
  private readonly _lastStations = new Map<Train, Station>();
  private readonly _reports = new Map<Train, Report>();
  private readonly _trainEnteredAreas = new MapArray<Train, Area>();
  private readonly _trainLeftAreas = new MapArray<Train, Area>();
  private readonly _trainOccupiedRoutes = new MapSet<Train, Route>();
  private readonly _trainReservedRoutes = new MapSet<Train, Route>();

  private readonly _trainsInArea = new MapSet<Area, Train>();

  private readonly _listeners = {
    "train-entered-area": new MapSet<
      Area,
      TrainTrackerListeners["train-entered-area"]
    >(),
    "train-left-area": new MapSet<
      Area,
      TrainTrackerListeners["train-left-area"]
    >(),
    "train-released-route": new Set<
      TrainTrackerListeners["train-released-route"]
    >(),
    "train-reserved-route": new Set<
      TrainTrackerListeners["train-reserved-route"]
    >(),
  };

  public get size(): number {
    return this._reports.size;
  }

  public get trainIDs(): string[] {
    return [...this._reports.values()].map((train): string => train.trainID);
  }

  public constructor(
    private readonly _log: CurryLog,
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

  private static readonly _singletons = new WeakMap<OTAPI, SingletonData>();

  public static getSingleton(
    otapi: OTAPI,
    infrastructure: Infrastructure,
    areas: Iterable<Area> = []
  ): TrainTracker {
    const data = this._singletons.get(otapi);

    if (data == null) {
      const singleton = new TrainTracker(
        curryLog().get("train-tracker-singleton"),
        otapi,
        infrastructure,
        areas
      );
      this._singletons.set(otapi, { singleton, otapi, infrastructure, areas });
      return singleton;
    } else if ((data.infrastructure !== infrastructure, data.areas !== areas)) {
      throw new Error("All singletons have to have the same arguments.");
    } else {
      return data.singleton;
    }
  }

  public getReport(train: Train | string): Report | undefined {
    return this._reports.get(
      typeof train === "string"
        ? this._infrastructure.getOrThrow("train", train)
        : train
    );
  }

  public getFirstStopReport(train: Train | string): Report | undefined {
    return this._firstStopReports.get(
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

  public getTrainsEnteredAreas(train: Train | string): readonly Area[] {
    return this._trainEnteredAreas.get(
      typeof train === "string"
        ? this._infrastructure.getOrThrow("train", train)
        : train
    );
  }

  public getTrainsLeftAreas(train: Train | string): readonly Area[] {
    return this._trainLeftAreas.get(
      typeof train === "string"
        ? this._infrastructure.getOrThrow("train", train)
        : train
    );
  }

  public getTrainsRoutes(train: Train | string): ReadonlySet<Route> {
    return this._trainOccupiedRoutes.get(
      typeof train === "string"
        ? this._infrastructure.getOrThrow("train", train)
        : train
    );
  }

  public getDelay(train: Train | string): number {
    return this.getReport(train)?.delay ?? 0;
  }

  public getCurrentStopDuration(train: Train | string): number {
    const report = this.getReport(train);
    const firstStopReport = this.getFirstStopReport(train);

    if (report != null && firstStopReport != null) {
      return report.time - firstStopReport.time;
    } else {
      return 0;
    }
  }

  public isReservedBy(train: Train | string, route: Route | string): boolean {
    return (
      this._trainReservedRoutes
        .get(
          typeof train === "string"
            ? this._infrastructure.getOrThrow("train", train)
            : train
        )
        ?.has(
          typeof route === "string"
            ? this._infrastructure.getOrThrow("route", route)
            : route
        ) ?? false
    );
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
      this._otapi.on("routeExit", this._handleRouteExit.bind(this)),

      this._otapi.on("routeReserved", this._handleRouteReserved.bind(this)),
      this._otapi.on("routeReleased", this._handleRouteReleased.bind(this))
    );

    return this;
  }

  public stopTraking(): this {
    this._cleanupCallbacks
      .splice(0)
      .forEach((callback): void => void callback());

    return this;
  }

  public onArea<Name extends keyof TrainTrackerAreaEvents>(
    eventName: Name,
    area: Area,
    handler: TrainTrackerListeners[Name]
  ): () => void {
    if (!this._areas.has(area)) {
      throw new Error("No such area.");
    }

    this._listeners[eventName].get(area).add(handler);

    return (): void => {
      this._listeners[eventName].get(area).delete(handler);
    };
  }

  public on<Name extends keyof TrainTrackerOtherEvents>(
    eventName: Name,
    handler: TrainTrackerListeners[Name]
  ): () => void {
    this._listeners[eventName].add(handler);

    return (): void => {
      this._listeners[eventName].delete(handler);
    };
  }

  public _emitAreaEvent(
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

  public _emitEvent<Name extends keyof TrainTrackerOtherEvents>(
    eventName: Name,
    payload: TrainTrackerOtherEvents[Name]
  ): void {
    for (const handler of this._listeners[eventName]) {
      handler(payload);
    }
  }

  private _enterArea(
    train: Train,
    area: Area,
    route: Route,
    time: number
  ): () => void {
    this._trainsInArea.get(area).add(train);
    this._trainEnteredAreas.get(train).push(area);

    return (): void => {
      this._emitAreaEvent("train-entered-area", area, train, route, time);
    };
  }

  private _leaveArea(
    train: Train,
    area: Area,
    route: Route,
    time: number
  ): () => void {
    this._trainsInArea.get(area).delete(train);
    this._trainLeftAreas.get(train).push(area);

    return (): void => {
      this._emitAreaEvent("train-left-area", area, train, route, time);
    };
  }

  private _handleTrainCreated(
    frequency: number,
    _name: string,
    { trainID }: EventPayloads["trainCreated"]
  ): void {
    this._otapi
      .setSendPositionReports({ trainID, flag: true, time: frequency })
      .catch((error): void => {
        this._log.error(
          error,
          `Failed to request position reports for ${trainID}.`
        );
      });
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
    if (newReport.speed === 0 && newReport.acceleration === 0) {
      if (!this._firstStopReports.has(train)) {
        this._firstStopReports.set(train, newReport);
      }
    } else {
      this._firstStopReports.delete(train);
    }
  }

  private _handleRouteEntry(
    _name: string,
    { trainID, routeID, time }: EventPayloads["routeEntry"]
  ): void {
    const emits: (() => void)[] = [];

    const route = this._infrastructure.getOrThrow("route", routeID);
    const train = this._infrastructure.getOrThrow("train", trainID);

    this._lastRoutes.set(train, route);
    this._trainOccupiedRoutes.get(train).add(route);

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

    const trainRoutes = this._trainOccupiedRoutes.get(train);
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

  private _handleRouteReserved(
    _name: string,
    { trainID, routeID, time }: EventPayloads["routeReserved"]
  ): void {
    const route = this._infrastructure.getOrThrow("route", routeID);
    const train = this._infrastructure.getOrThrow("train", trainID);

    this._trainReservedRoutes.get(train).add(route);

    this._emitEvent("train-reserved-route", { train, route, time });
  }

  private _handleRouteReleased(
    _name: string,
    { trainID, routeID, time }: EventPayloads["routeReleased"]
  ): void {
    const route = this._infrastructure.getOrThrow("route", routeID);
    const train = this._infrastructure.getOrThrow("train", trainID);

    this._trainReservedRoutes.get(train).delete(route);

    this._emitEvent("train-released-route", { train, route, time });
  }

  private _handleTrainDeleted(
    _name: string,
    { trainID }: EventPayloads["trainDeleted"]
  ): void {
    const train = this._infrastructure.getOrThrow("train", trainID);

    this._firstStopReports.delete(train);
    this._lastRoutes.delete(train);
    this._lastStations.delete(train);
    this._reports.delete(train);
    this._trainOccupiedRoutes.delete(train);

    for (const trains of this._trainsInArea.values()) {
      trains.delete(train);
    }
  }
}
