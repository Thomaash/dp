import { Content } from "./core";
import { EventNames, EventPayloads } from "./events";

export function createPayload<EventName extends EventNames>(
  eventName: EventName,
  content: Content
): EventPayloads[EventName] {
  switch (eventName) {
    case "simReadyForSimulation":
    case "simServerStarted":
    case "test":
      return {};
    default:
      console.error(`Unknown SOAP function name “${eventName}”.`);
      return {};
    // TODO: This should work.
    // default:
    //   const never: never = eventName;
    //   throw new TypeError(`Unacceptable value “${never}”.`);
  }
}
