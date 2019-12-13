import { Content } from "./core";
import { EventNames, EventPayloads } from "./events";

function number(input: string): number | undefined {
  return input != null ? +input : void 0;
}

export function createPayload<EventName extends EventNames>(
  eventName: EventName,
  content: Content
): EventPayloads[EventName];
export function createPayload(
  eventName: EventNames,
  content: Content
): EventPayloads[EventNames] {
  const attrs = content.attributes;

  switch (eventName) {
    case "infraPartEntry":
    case "infraPartExit":
    case "infraPartReleased":
    case "infraPartReserved":
      return {
        infraPartID: attrs["infraPartID"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"]
      };

    case "ping":
    case "simPaused":
    case "simStarted":
    case "simStopped":
      return {
        time: number(attrs["time"])
      };

    case "routePartReleased":
      return {
        partID: attrs["partID"],
        routeID: attrs["routeID"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"]
      };

    case "routeEntry":
    case "routeExit":
    case "routeReleased":
    case "routeReserved":
      return {
        routeID: attrs["routeID"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"]
      };

    case "signalPassed":
      return {
        signalAspect: attrs["signalAspect"],
        signalID: attrs["signalID"],
        signalType: attrs["signalType"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"]
      };

    case "simReadyForSimulation":
    case "simServerStarted":
      return {};

    case "trainArrival":
    case "trainDeparture":
    case "trainPass":
      return {
        delay: number(attrs["delay"]),
        stationID: attrs["stationID"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"]
      };

    case "trainCreated":
    case "trainDeleted":
      return {
        time: number(attrs["time"]),
        trainID: attrs["trainID"]
      };

    case "trainPositionReport":
      return {
        acceleration: number(attrs["acceleration"]),
        delay: number(attrs["delay"]),
        routeID: attrs["routeID"],
        routeOffset: number(attrs["routeOffset"]),
        speed: number(attrs["speed"]),
        time: number(attrs["time"]),
        trainID: attrs["trainID"]
      };

    default:
      const never: never = eventName;
      throw new TypeError(`Unacceptable value “${never}”.`);
  }
}
