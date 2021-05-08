import {
  CommonTimetableEntry,
  Itinerary,
  Path,
  Route,
  Station,
  Timetable,
  Train,
  Vertex,
} from "../infrastructure";
import { Area } from "../train-tracker";
import { CurryLog } from "../curry-log";

export { Area, Itinerary, Path, Route, Station, Train, Vertex };

export interface DecisionModuleAPI {
  log: CurryLog;

  formatSimulationTime(simulationTime: number, ms?: boolean): string;

  cancelOvertaking(overtaking: Train, waiting: Train): void;
  planOvertaking(overtaking: Train, waiting: Train): void;

  getTrain(trainID: string): Train;
  getTrainsDelayedArrivalAtStation(
    train: Train,
    station: Station,
    stopTimeAdjustment?: boolean
  ): number;
  getTrainsLastStation(train: Train): Station | undefined;
  getTrainsInArea(area: Area): { train: Train; position: number }[];
  getTrainsTimetableReserve(
    train: Train,
    fromStation: Station,
    toStation: Station,
    inclusive?: boolean
  ): number;
  getCommonTimetableEntries(
    fromStation: Station,
    timetable1: Timetable,
    timetable2: Timetable
  ): CommonTimetableEntry[];

  getOvertakingAreasByStation(station: Station): ReadonlySet<OvertakingArea>;
  getOvertakingAreasByStations(
    inflowStation: Station | null,
    station: Station
  ): ReadonlySet<OvertakingArea>;
}

export interface OvertakingArea extends Area {
  readonly entryRoutes: ReadonlySet<Route>;
  readonly entryVertexes: ReadonlySet<Vertex>;
  readonly exitRoutes: ReadonlySet<Route>;
  readonly exitVertex: Vertex;
  readonly inflowStations: ReadonlySet<Station>;
  readonly itineraries: ReadonlySet<Itinerary>;
  readonly leaveOnlyAfterDepartureFromStation: boolean;
  readonly maxWaiting: number;
  readonly outflowStation: Station;
  readonly overtakingAreaID: string;
  readonly routes: ReadonlySet<Route>;
  readonly stationAreas: ReadonlySet<Station>;
  readonly stations: ReadonlySet<Station>;
  readonly waitingRoutes: ReadonlySet<Route>;
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

export interface DecisionModuleFactory {
  name: string;
  create(params: Record<string, any>): DecisionModule;
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
