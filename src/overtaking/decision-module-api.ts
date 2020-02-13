import { expect } from "chai";
import { Train, Route, Itinerary, Station } from "../infrastructure";

export interface DecisionModuleAPI {
  getTrain(trainID: string): Train;
  getTrainsOnItinerary(
    itinerary: string | Itinerary
  ): { train: Train; position: number }[];
}

export interface OvertakingArea {
  exitRoute: Route;
  itinerary: Itinerary;
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
