import { EventPayloads, OTAPI } from "../otapi";
import {
  Infrastructure,
  Itinerary,
  Station,
  Train,
  Route
} from "../infrastructure";
import { MapOfSets, haveIntersection } from "../util";

export type Report = EventPayloads["trainPositionReport"];

export interface TrainPositionOnItinerary {
  train: Train;
  position: number;
}

export type TrainHandler = (payload: {
  train: Train;
  route: Route;
  time: number;
}) => void;

export class TrainTracker {
  private readonly _cleanupCallbacks: (() => void)[] = [];

  private readonly _itinerariesByRouteID = new MapOfSets<string, Itinerary>();
  private readonly _itineraryRoutes = new MapOfSets<string, Route>();

  private readonly _lastStations = new Map<string, Station>();
  private readonly _reports = new Map<string, Report>();
  private readonly _trainRoutes = new MapOfSets<string, Route>();
  private readonly _trainsOnItinerary = new MapOfSets<string, Train>();

  private readonly _listeners = {
    "train-entered-itinerary": new MapOfSets<Itinerary, TrainHandler>(),
    "train-left-itinerary": new MapOfSets<Itinerary, TrainHandler>()
  };

  public get size(): number {
    return this._reports.size;
  }

  public get trainIDs(): string[] {
    return [...this._reports.keys()];
  }

  public constructor(
    private readonly _otapi: OTAPI,
    private readonly _infrastructure: Infrastructure
  ) {
    for (const [itineraryID, itinerary] of this._infrastructure.itineraries) {
      this._itineraryRoutes.set(itineraryID, new Set(itinerary.routes));

      for (const { routeID } of itinerary.routes) {
        this._itinerariesByRouteID.get(routeID).add(itinerary);
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
   * itinerary is first.
   */
  public getTrainsOnItineraryInOrder(
    itinerary: Itinerary
  ): TrainPositionOnItinerary[] {
    const firstRouteID = itinerary.routes[0].routeID;

    return [...this._trainsOnItinerary.get(itinerary.itineraryID).values()]
      .map(
        (train): Partial<TrainPositionOnItinerary> => {
          const report = this._reports.get(train.trainID);

          // The reports arrive with some delay. It's possible we don't have any
          // or that the report we do have is not on the itinerary yet. If the
          // train is on this itinerary but we don't have a report yet assume
          // it's at the very beginning.
          const routeID = report?.routeID ?? firstRouteID;
          const routeOffset = report?.routeOffset ?? 0;

          return {
            train,
            position:
              this._infrastructure.getItineraryOffset(
                itinerary,
                routeID,
                routeOffset
              ) ?? 0
          };
        }
      )
      .filter(
        (tpoi): tpoi is TrainPositionOnItinerary =>
          tpoi.train != null && tpoi.position != null
      )
      .sort((a, b): number => b.position - a.position);
  }

  public getTrainIDsOnItinerary(itinerary: Itinerary): Train[] {
    return [...this._trainsOnItinerary.get(itinerary.itineraryID).values()];
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
    eventName: "train-entered-itinerary" | "train-left-itinerary",
    itinerary: Itinerary,
    handler: TrainHandler
  ): () => void {
    this._listeners[eventName].get(itinerary).add(handler);

    return (): void => {
      this._listeners[eventName].get(itinerary).delete(handler);
    };
  }

  public _emit(
    eventName: "train-entered-itinerary" | "train-left-itinerary",
    itinerary: Itinerary,
    train: Train,
    route: Route,
    time: number
  ): void {
    for (const handler of this._listeners[eventName].get(itinerary).values()) {
      handler({ train, route, time });
    }
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
      "stations",
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

    const route = this._infrastructure.getOrThrow("routes", routeID);
    const train = this._infrastructure.getOrThrow("trains", trainID);

    this._trainRoutes.get(trainID).add(route);

    for (const itinerary of this._itinerariesByRouteID.get(routeID)) {
      const trainsOnItinerary = this._trainsOnItinerary.get(
        itinerary.itineraryID
      );

      if (!trainsOnItinerary.has(train)) {
        trainsOnItinerary.add(train);
        emits.push((): void => {
          this._emit("train-entered-itinerary", itinerary, train, route, time);
        });
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

    const route = this._infrastructure.getOrThrow("routes", routeID);
    const train = this._infrastructure.getOrThrow("trains", trainID);

    const trainRoutes = this._trainRoutes.get(trainID);
    trainRoutes.delete(route);

    for (const itinerary of this._itinerariesByRouteID.get(routeID)) {
      if (
        !haveIntersection(
          trainRoutes,
          this._itineraryRoutes.get(itinerary.itineraryID)
        )
      ) {
        this._trainsOnItinerary.get(itinerary.itineraryID).delete(train);

        emits.push((): void => {
          this._emit("train-left-itinerary", itinerary, train, route, time);
        });
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
    this._reports.delete(trainID);
    this._lastStations.delete(trainID);

    const train = this._infrastructure.getOrThrow("trains", trainID);
    this._trainRoutes.delete(trainID);
    for (const trainsOnItinerary of this._trainsOnItinerary.values()) {
      trainsOnItinerary.delete(train);
    }
  }
}
