import { Content } from "./manager";
import { EventNames, EventPayloads } from "./events";

function number(input: string): number | undefined {
  return input != null ? +input : void 0;
}

// TODO: Strip this in production build.
function verifyPayload(
  name: string,
  attrs: object,
  ...variants: string[][]
): void {
  const keysJSON = JSON.stringify(Object.keys(attrs).sort());
  for (const variant of variants) {
    const variantJSON = JSON.stringify(variant.sort());
    if (keysJSON === variantJSON) {
      // A match was found. Everything's okay.
      return;
    }
  }

  const payloadText = JSON.stringify(attrs);
  console.error(
    [
      `Unexpected keys were found in the payload (${payloadText}) for ${name}:`,
      "  Actual:",
      "    " + Object.keys(attrs).sort().join(", "),
      "  Expected (one of):",
      ...variants.map((variant): string => "    " + variant.sort().join(", ")),
      "",
    ].join("\n")
  );
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
      verifyPayload(eventName, attrs, ["infraPartID", "time", "trainID"]);
      return {
        infraPartID: attrs["infraPartID"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"],
      };

    case "ping":
    case "simContinued":
    case "simPaused":
    case "simStarted":
    case "simStopped":
      verifyPayload(eventName, attrs, ["time"]);
      return {
        time: number(attrs["time"]),
      };

    case "routePartReleased":
      verifyPayload(eventName, attrs, ["partID", "routeID", "time", "trainID"]);
      return {
        partID: attrs["partID"],
        routeID: attrs["routeID"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"],
      };

    case "routeEntry":
    case "routeExit":
    case "routeReleased":
    case "routeReserved":
      verifyPayload(eventName, attrs, ["routeID", "time", "trainID"]);
      return {
        routeID: attrs["routeID"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"],
      };

    case "signalPassed":
      verifyPayload(
        eventName,
        attrs,
        [
          "routeID",
          "signalAspectDistant",
          "signalAspectMain",
          "signalID",
          "signalType",
          "time",
          "trainID",
        ],
        [
          "routeID",
          "signalAspectMain",
          "signalID",
          "signalType",
          "time",
          "trainID",
        ],
        ["signalAspectMain", "signalID", "signalType", "time", "trainID"],
        ["signalID", "signalType", "time", "trainID"]
      );
      return {
        routeID: attrs["routeID"],
        signalAspectDistant: attrs["signalAspectDistant"],
        signalAspectMain: attrs["signalAspectMain"],
        signalID: attrs["signalID"],
        signalType: attrs["signalType"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"],
      };

    case "simReadyForSimulation":
    case "simServerStarted":
      verifyPayload(eventName, attrs, []);
      return {};

    case "trainArrival":
    case "trainDeparture":
    case "trainPass":
      verifyPayload(eventName, attrs, [
        "delay",
        "stationID",
        "time",
        "trainID",
      ]);
      return {
        delay: number(attrs["delay"]),
        stationID: attrs["stationID"],
        time: number(attrs["time"]),
        trainID: attrs["trainID"],
      };

    case "trainCreated":
    case "trainDeleted":
      verifyPayload(eventName, attrs, ["time", "trainID"]);
      return {
        time: number(attrs["time"]),
        trainID: attrs["trainID"],
      };

    case "trainPositionReport":
      verifyPayload(eventName, attrs, [
        "acceleration",
        "delay",
        "routeID",
        "routeOffset",
        "speed",
        "time",
        "trainID",
      ]);
      return {
        acceleration: number(attrs["acceleration"]),
        delay: number(attrs["delay"]),
        routeID: attrs["routeID"],
        routeOffset: number(attrs["routeOffset"]),
        speed: number(attrs["speed"]),
        time: number(attrs["time"]),
        trainID: attrs["trainID"],
      };

    default:
      const never: never = eventName;
      throw new TypeError(
        `Unacceptable value "${never}" with xml:\n${content.raw}\n\n`
      );
  }
}
