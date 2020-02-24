import {
  Itinerary,
  Route,
  Station,
  Train,
  Vertex,
  Path
} from "../infrastructure";
import { Area } from "../train-tracker";

export { Area, Itinerary, Path, Route, Station, Train, Vertex };

export interface DecisionModuleAPI {
  cancelOvertaking(overtaking: Train, waiting: Train): Promise<void>;
  planOvertaking(overtaking: Train, waiting: Train): Promise<void>;

  getTrain(trainID: string): Train;
  getTrainsDelayedArrivalAtStation(train: Train, station: Station): number;
  getTrainsLastStation(train: Train): Station | undefined;
  getTrainsInArea(area: Area): { train: Train; position: number }[];
  getTrainsTimetableReserve(
    train: Train,
    fromStation: Station,
    toStation: Station,
    inclusive?: boolean
  ): number;
}

export interface OvertakingArea {
  readonly entryVertexes: ReadonlySet<Vertex>;
  readonly exitRoutes: ReadonlySet<Route>;
  readonly exitVertex: Vertex;
  readonly itineraries: ReadonlySet<Itinerary>;
  readonly next: ReadonlySet<OvertakingArea>;
  readonly overtakingAreaID: string;
  readonly previous: ReadonlySet<OvertakingArea>;
  readonly routes: ReadonlySet<Route>;
  readonly station: Station;
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
