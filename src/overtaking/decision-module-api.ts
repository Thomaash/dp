import { expect } from "chai";
import { Itinerary, Route, Station, Train } from "../infrastructure";

export interface DecisionModuleAPI {
  getTrain(trainID: string): Train;
  getTrainsDelayedArrivalAtStation(train: Train, station: Station): number;
  getTrainsLastStation(train: Train): Station | undefined;
  getTrainsOnItinerary(
    itinerary: string | Itinerary
  ): { train: Train; position: number }[];
  getTrainsTimetableReserve(
    train: Train,
    fromStation: Station,
    toStation: Station,
    inclusive?: boolean
  ): number;
}

export interface OvertakingArea {
  exitRoute: Route;
  itinerary: Itinerary;
  next: OvertakingArea[];
  previous: OvertakingArea[];
  station: Station;
}

export interface OvertakingDecision {
  overtaking: Train;
  waiting: Train;
}

export interface Time {
  time: number;
}

export interface NewTrainEntedOvertakingAreaParams extends Time {
  entryRoute: Route;
  newTrain: Train;
  overtakingArea: OvertakingArea;
}

export interface DecisionModule {
  name: string;

  newTrainEnteredOvertakingArea(
    api: DecisionModuleAPI,
    params: NewTrainEntedOvertakingAreaParams
  ): Promise<OvertakingDecision[]> | OvertakingDecision[];
}

export function validateModule(decisionModule: unknown): void {
  expect(decisionModule, "Each module has to have a name")
    .to.have.ownProperty("name")
    .that.is.a("string")
    .and.does.not.equal("");

  expect(decisionModule)
    .to.have.ownProperty("newTrainEnteredOvertakingArea")
    .that.is.a("function");
}
