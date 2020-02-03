import { EventPayloads, OTAPI } from "../otapi";
import { Infrastructure } from "../infrastructure";

export type Report = EventPayloads["trainPositionReport"];

export class TrainTracker {
  private readonly _cleanupCallbacks: (() => void)[] = [];
  private readonly _reports = new Map<string, Report>();

  public get size(): number {
    return this._reports.size;
  }

  public get trainIDs(): string[] {
    return [...this._reports.keys()];
  }

  public constructor(
    private readonly _otapi: OTAPI,
    private readonly _infrastructure: Infrastructure
  ) {}

  public getReport(trainID: string): Report | undefined {
    return this._reports.get(trainID);
  }

  public getTrainsOnItinerary(itineraryID: string): string[] {
    const itinerary = this._infrastructure.itineraries.get(itineraryID);

    if (itinerary == null) {
      throw new Error(`There's no itinerary called ${itineraryID}.`);
    }

    const routes = new Set(
      itinerary.routes.map((route): string => route.routeID)
    );
    return [...this._reports.values()]
      .filter((report): boolean => routes.has(report.routeID))
      .map((report): string => report.trainID);
  }

  /**
   * @returns The distance in meters from the start of the itinerary or null if
   * the train is not on it's main itinerary.
   */
  public getTrainPositionOnMainItinerary(trainID: string): number | null {
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
      this._otapi.on(
        "trainPositionReport",
        this._handleTrainPositionReport.bind(this)
      ),
      this._otapi.on("trainDeleted", this._handleTrainDeleted.bind(this))
    );

    return this;
  }

  public stopTraking(): this {
    this._cleanupCallbacks
      .splice(0)
      .forEach((callback): void => void callback());

    return this;
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

  private _handleTrainPositionReport(
    _name: string,
    report: EventPayloads["trainPositionReport"]
  ): void {
    this._reports.set(report.trainID, report);
  }

  private _handleTrainDeleted(
    _name: string,
    { trainID }: EventPayloads["trainDeleted"]
  ): void {
    this._reports.delete(trainID);
  }
}
