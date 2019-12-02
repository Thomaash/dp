import { Config } from "../../config";
import { addListener, removeListener, Content } from "./core";

interface EventPayloads {
  test: void; // TODO: Delete this!

  simReadyForSimulation: void;
  simServerStarted: void;
}

export function once<EventName extends keyof EventPayloads>(
  this: Config,
  eventName: EventName
): Promise<EventPayloads[EventName]> {
  return new Promise<EventPayloads[EventName]>((resolve, reject): void => {
    const callback = (content: Content): void => {
      if (content.name !== eventName) {
        return; // we're waiting for different event.
      }

      removeListener
        .call(this, callback)
        .catch(reject)
        .then((): void => {
          resolve(); // TODO: Pass the data in a type safe way.
        });
    };

    addListener.call(this, callback).catch(reject);
  });
}
