import { EventPayloads, OTAPI } from "../otapi";
import {
  Infrastructure,
  Itinerary,
  Station,
  Train,
  Route
} from "../infrastructure";
import { MapSet, haveIntersection } from "../util";
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

  private readonly _areaRoutes = new MapSet<Area, Route>();
  private readonly _areas: ReadonlySet<Area>;
  private readonly _areasByRouteID = new MapSet<string, Area>();
  private readonly _itinerariesByRouteID = new MapSet<string, Itinerary>();

  private readonly _lastRoutes = new Map<string, Route>();
  private readonly _lastStations = new Map<string, Station>();
  private readonly _reports = new Map<string, Report>();
  private readonly _trainRoutes = new MapSet<string, Route>();

  private readonly _trainsInArea = new MapSet<Area, Train>();

  private readonly _listeners = {
    "train-entered-area": new MapSet<Area, TrainHandler>(),
    "train-left-area": new MapSet<Area, TrainHandler>()
  };

  public get size(): number {
    return this._reports.size;
  }

  public get trainIDs(): string[] {
    return [...this._reports.keys()];
  }

  public constructor(
    private readonly _otapi: OTAPI,
    private readonly _infrastructure: Infrastructure,
    areas: Iterable<Area> = []
  ) {
    this._areas = new Set<Area>(areas);

    for (const itinerary of this._infrastructure.itineraries.values()) {
      for (const { routeID } of itinerary.routes) {
        this._itinerariesByRouteID.get(routeID).add(itinerary);
      }
    }

    for (const area of this._areas) {
      this._areaRoutes.set(area, new Set(area.entryRoutes));

      for (const { routeID } of area.entryRoutes) {
        this._areasByRouteID.get(routeID).add(area);
      }
    }
  }

  public getReport(trainID: string): Report | undefined {
    return this._reports.get(trainID);
  }

  public getTrainsLastStation(trainID: string): Station | undefined {
    return this._lastStations.get(trainID);
  }

  public getTrainsRoutes(trainID: string): ReadonlySet<Route> {
    return this._trainRoutes.get(trainID);
  }

  public getDelay(trainID: string): number {
    return this.getReport(trainID)?.delay ?? 0;
  }

  /**
   * The trains are sorted so that the train that is closest to the end of the
   * area is first.
   *
   * @remarks
   * The position is from the end of the area.
   */
  public getTrainsInAreaInOrder(area: Area): TrainPositionInArea[] {
    return [...this._trainsInArea.get(area).values()]
      .map(
        (train): TrainPositionInArea => {
          const report = this._reports.get(train.trainID);

          const route = this._lastRoutes.get(train.trainID);
          if (route == null) {
            throw new Bug(`Couldn't find last route of ${train.trainID}. `);
          }

          // The reports arrive with some delay. It's possible we don't have any
          // or that the report we do have is not on the itinerary yet. If the
          // train is on this itinerary but we don't have a report yet assume
          // it's at the very beginning.
          const routeOffset =
            report && report.routeID === route.routeID ? report.routeOffset : 0;

          const distanceToEnd = this._infrastructure.getShortestWayFromRouteToAnyRoute(
            route,
            area.exitRoutes,
            routeOffset
          ).length;

          // If the train can't get to any exit route of the area it is assumed
          // it already reached a point where it leaves the area.
          const position =
            distanceToEnd === Number.POSITIVE_INFINITY ? 0 : distanceToEnd;

          return {
            train,
            position
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
    const train = this._infrastructure.trains.get(trainID);
    if (train == null) {
      throw new Error(`There's no train with ${trainID} id.`);
    }

    const report = this._reports.get(trainID);
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
    console.log(`Train ${train.trainID} entered area ${area.areaID}.`);
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
    console.log(`Train ${train.trainID} left area ${area.areaID}.`);
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

    this._lastStations.set(report.trainID, station);
  }

  private _handleTrainPositionReport(
    _name: string,
    newReport: EventPayloads["trainPositionReport"]
  ): void {
    this._reports.set(newReport.trainID, newReport);
  }

  private _handleRouteEntry(
    _name: string,
    { trainID, routeID, time }: EventPayloads["routeEntry"]
  ): void {
    const emits: (() => void)[] = [];

    const route = this._infrastructure.getOrThrow("route", routeID);
    const train = this._infrastructure.getOrThrow("train", trainID);

    this._lastRoutes.set(trainID, route);
    this._trainRoutes.get(trainID).add(route);

    for (const area of this._areasByRouteID.get(routeID)) {
      const trainsInArea = this._trainsInArea.get(area);

      if (!trainsInArea.has(train)) {
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

    const trainRoutes = this._trainRoutes.get(trainID);
    trainRoutes.delete(route);

    for (const area of this._areasByRouteID.get(routeID)) {
      if (haveIntersection(trainRoutes, area.routes)) {
        continue;
      }

      emits.push(this._leaveArea(train, area, route, time));
    }

    for (const emit of emits) {
      emit();
    }
  }

  private _handleTrainDeleted(
    _name: string,
    { trainID }: EventPayloads["trainDeleted"]
  ): void {
    this._lastRoutes.delete(trainID);
    this._lastStations.delete(trainID);
    this._reports.delete(trainID);
    this._trainRoutes.delete(trainID);

    const train = this._infrastructure.getOrThrow("train", trainID);
    for (const trains of this._trainsInArea.values()) {
      trains.delete(train);
    }
  }
}
