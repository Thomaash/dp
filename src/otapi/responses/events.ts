export interface EventPayloads {
  infraPartEntry: { trainID: string; infraPartID: string; time: number };
  infraPartExit: { trainID: string; infraPartID: string; time: number };
  infraPartReleased: { trainID: string; infraPartID: string; time: number };
  infraPartReserved: { trainID: string; infraPartID: string; time: number };
  ping: { time: number };
  routeEntry: { trainID: string; routeID: string; time: number };
  routeExit: { trainID: string; routeID: string; time: number };
  routePartReleased: {
    trainID: string;
    routeID: string;
    partID: string;
    time: number;
  };
  routeReleased: { trainID: string; routeID: string; time: number };
  routeReserved: { trainID: string; routeID: string; time: number };
  signalPassed: {
    trainID: string;
    signalID: string;
    signalType: string;
    signalAspect?: string;
    time: number;
  };
  simContinued: { time: number };
  simPaused: { time: number };
  simReadyForSimulation: {};
  simServerStarted: {};
  simStarted: { time: number };
  simStopped: { time: number };
  trainArrival: {
    trainID: string;
    stationID: string;
    time: number;
    delay: number;
  };
  trainCreated: { trainID: string; time: number };
  trainDeleted: { trainID: string; time: number };
  trainDeparture: {
    trainID: string;
    stationID: string;
    time: number;
    delay: number;
  };
  trainPass: {
    trainID: string;
    stationID: string;
    time: number;
    delay: number;
  };
  trainPositionReport: {
    trainID: string;
    routeID: string;
    routeOffset: number;
    time: number;
    delay: number;
    speed: number;
    acceleration: number;
  };
}

export type EventNames = keyof EventPayloads;
