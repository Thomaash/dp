export interface EventPayloads {
  infraPartEntry: { trainID: string; infraPartID: string; time: number };
  infraPartExit: { trainID: string; infraPartID: string; time: number };
  infraPartReleased: { trainID: string; infraPartID: string; time: number };
  infraPartReserved: { trainID: string; infraPartID: string; time: number };
  ping: { time: number };
  routeEntry: { trainID: string; routeID: string; time: number };
  routeExit: { trainID: string; routeID: string; time: number };
  routePartReleased: {
    partID: string;
    routeID: string;
    time: number;
    trainID: string;
  };
  routeReleased: { trainID: string; routeID: string; time: number };
  routeReserved: { trainID: string; routeID: string; time: number };
  signalPassed: {
    routeID?: string;
    signalAspectDistant?: string;
    signalAspectMain?: string;
    signalID: string;
    signalType: string;
    time: number;
    trainID: string;
  };
  simContinued: { time: number };
  simPaused: { time: number };
  simReadyForSimulation: {};
  simServerStarted: {};
  simStarted: { time: number };
  simStopped: { time: number };
  trainArrival: {
    delay: number;
    stationID: string;
    time: number;
    trainID: string;
  };
  trainCreated: { trainID: string; time: number };
  trainDeleted: { trainID: string; time: number };
  trainDeparture: {
    delay: number;
    stationID: string;
    time: number;
    trainID: string;
  };
  trainPass: {
    delay: number;
    stationID: string;
    time: number;
    trainID: string;
  };
  trainPositionReport: {
    acceleration: number;
    delay: number;
    routeID: string;
    routeOffset: number;
    speed: number;
    time: number;
    trainID: string;
  };
  trainStopped: {
    routeID: string;
    routeOffset: number;
    stopType: TrainStopType;
    time: number;
    trainID: string;
  };
}

export type TrainStopType = "stopUnknown" | "stopUnexpected";

export type EventNames = keyof EventPayloads;

export const eventGroupNames = [
  "InfraPart",
  "Route",
  "Server",
  "Signal",
  "Simulation",
  "Timetable",
  "Train Position Report",
  "Train",
] as const;
export type EventGroup = typeof eventGroupNames[number];
export const eventGroups: {
  [EventName in keyof EventPayloads]: EventGroup;
} = {
  infraPartEntry: "InfraPart",
  infraPartExit: "InfraPart",
  infraPartReleased: "InfraPart",
  infraPartReserved: "InfraPart",
  ping: "Simulation",
  routeEntry: "Route",
  routeExit: "Route",
  routePartReleased: "Route",
  routeReleased: "Route",
  routeReserved: "Route",
  signalPassed: "Signal",
  simContinued: "Simulation",
  simPaused: "Simulation",
  simReadyForSimulation: "Simulation",
  simServerStarted: "Server",
  simStarted: "Simulation",
  simStopped: "Simulation",
  trainArrival: "Timetable",
  trainCreated: "Train",
  trainDeleted: "Train",
  trainDeparture: "Timetable",
  trainPass: "Timetable",
  trainPositionReport: "Train Position Report",
  trainStopped: "Train",
};
