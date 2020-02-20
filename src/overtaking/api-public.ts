import { Itinerary, Route, Station, Train } from "../infrastructure";

export interface DecisionModuleAPI {
  cancelOvertaking(overtaking: Train, waiting: Train): Promise<void>;
  planOvertaking(overtaking: Train, waiting: Train): Promise<void>;

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
  entryRoute: Route;
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
  ):
    | Promise<OvertakingDecision[]>
    | OvertakingDecision[]
    | Promise<void>
    | void;
}
