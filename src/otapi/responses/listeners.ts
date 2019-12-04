import { Config } from "../config";
import { EventNames, EventPayloads } from "./events";
import { addListener, removeListener, Content } from "./core";
import { createPayload } from "./payload";

export type EventCallback<EventName extends keyof EventPayloads> = (
  payload: EventPayloads[EventName]
) => void;
export type AnyEventCallback = (
  name: EventNames,
  payload: EventPayloads[EventNames]
) => void;

const filteredCallbacks = new Map<any, any>();

export function on<EventName extends keyof EventPayloads>(
  this: Config,
  eventName: EventName,
  callback: EventCallback<EventName>
): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    const filteredCallback = (content: Content): void => {
      if (content.name !== eventName) {
        return; // we're waiting for different event.
      }

      callback(createPayload(eventName, content));
    };

    filteredCallbacks.set(callback, filteredCallback);

    addListener
      .call(this, filteredCallback)
      .catch(reject)
      .then(resolve);
  });
}

export function off<EventName extends keyof EventPayloads>(
  this: Config,
  _eventName: EventName,
  callback: EventCallback<EventName>
): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    const filteredCallback = filteredCallbacks.get(callback);
    if (filteredCallback == null) {
      return resolve();
    }

    filteredCallbacks.delete(callback);
    removeListener
      .call(this, filteredCallback)
      .catch(reject)
      .then(resolve);
  });
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
          resolve(createPayload(eventName, content));
        });
    };

    addListener.call(this, callback).catch(reject);
  });
}

export function onAny(this: Config, callback: AnyEventCallback): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    const filteredCallback = (content: Content): void => {
      callback(
        content.name as EventNames,
        createPayload(content.name as EventNames, content)
      );
    };

    filteredCallbacks.set(callback, filteredCallback);

    addListener
      .call(this, filteredCallback)
      .catch(reject)
      .then(resolve);
  });
}

export function offAny(
  this: Config,
  callback: AnyEventCallback
): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    const filteredCallback = filteredCallbacks.get(callback);
    if (filteredCallback == null) {
      return resolve();
    }

    filteredCallbacks.delete(callback);
    removeListener
      .call(this, filteredCallback)
      .catch(reject)
      .then(resolve);
  });
}

export function onceAny(
  this: Config
): Promise<[EventNames, EventPayloads[EventNames]]> {
  return new Promise<[EventNames, EventPayloads[EventNames]]>(
    (resolve, reject): void => {
      const callback = (content: Content): void => {
        removeListener
          .call(this, callback)
          .catch(reject)
          .then((): void => {
            resolve([
              content.name as EventNames,
              createPayload(content.name as EventNames, content)
            ]);
          });
      };

      addListener.call(this, callback).catch(reject);
    }
  );
}
