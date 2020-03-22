import bodyParser from "body-parser";
import express from "express";
import xml2js from "xml2js";
import { Config } from "../config";
import { EventNames, EventPayloads } from "./events";
import { Server } from "http";
import { createPayload } from "./payload";

export interface Content {
  attributes: Record<string, string>;
  name: string;
  raw: string;
  xml: any;
}

export type EventCallback<EventName extends keyof EventPayloads> = (
  name: EventNames,
  payload: EventPayloads[EventName]
) => void;
export type AnyEventCallback = EventCallback<keyof EventPayloads>;
type EventNamePayloadPairMap = {
  [Name in keyof EventPayloads]: [Name, EventPayloads[Name]];
};
export type EventNamePayloadPair = EventNamePayloadPairMap[keyof EventNamePayloadPairMap];

const xmlParser = new xml2js.Parser();
async function processSOAP(raw: string): Promise<Content> {
  const soapXML = await xmlParser.parseStringPromise(raw);

  // There will never be less or more than one element in the body of a valid
  // SOAP message. If the input is not valid let's just crash for now.
  const xml = soapXML["SOAP-ENV:Envelope"]["SOAP-ENV:Body"][0];
  const name = Object.keys(xml)[0];
  const attributes = xml[name][0].$ || {};

  return {
    attributes,
    name,
    raw,
    xml,
  };
}

const anyEvent = Symbol("Any event");

export class ResponseManager {
  private readonly _manies = new Map<
    string | typeof anyEvent,
    EventCallback<keyof EventPayloads>[]
  >();
  private readonly _onces = new Map<
    string | typeof anyEvent,
    EventCallback<keyof EventPayloads>[]
  >();

  private readonly _rejectOnKill = new Set<(error: Error) => void>();

  private _server: null | Server = null;

  public constructor(private _config: Config) {}

  public async start(): Promise<void> {
    return new Promise((resolve, reject): void => {
      const app = express();

      app.use(
        bodyParser.text({
          type: (): boolean => true,
          limit: "50mb",
        })
      );

      app.all(
        "*",
        async (req): Promise<void> => {
          const soap = await processSOAP(req.body);
          const name: EventNames = soap.name as any;
          const payload = createPayload(name, soap);

          [
            ...(this._manies.get(anyEvent) || []),
            ...(this._manies.get(soap.name) || []),
          ].forEach((callback): void => {
            callback(name, payload);
          });

          [
            ...(this._onces.get(anyEvent) || []).splice(0),
            ...(this._onces.get(soap.name) || []).splice(0),
          ].forEach((callback): void => {
            callback(name, payload);
          });
        }
      );

      this._server = app.listen(
        this._config.portApp,
        (error): void => void (error ? reject(error) : resolve())
      );
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject): void => {
      if (this._server != null) {
        this._server.close(
          (error): void => void (error ? reject(error) : resolve())
        );
        this._server = null;
      } else {
        resolve();
      }
    });
  }

  public async kill(): Promise<void> {
    try {
      await this.stop();
    } finally {
      this._manies.clear();
      this._onces.clear();

      this._rejectOnKill.forEach((reject): void =>
        reject(new Error("This OTAPI session has been killed."))
      );
      this._rejectOnKill.clear();
    }
  }

  public on(callback: EventCallback<keyof EventPayloads>): () => void;
  public on<EventName extends keyof EventPayloads>(
    eventName: EventName,
    callback: EventCallback<EventName>
  ): () => void;
  public on<EventName extends keyof EventPayloads = keyof EventPayloads>(
    ...rest:
      | [EventCallback<EventNames>]
      | [EventName, EventCallback<EventNames>]
  ): () => void {
    switch (rest.length) {
      case 1:
        return this._push(this._manies, anyEvent, rest[0]);
      case 2:
        return this._push(this._manies, rest[0], rest[1]);
      default:
        throw new TypeError("Wrong number of arguments.");
    }
  }

  public off(callback: EventCallback<keyof EventPayloads>): void;
  public off<EventName extends keyof EventPayloads>(
    eventName: EventName,
    callback: EventCallback<EventName>
  ): void;
  public off<EventName extends keyof EventPayloads = keyof EventPayloads>(
    ...rest:
      | [EventCallback<EventNames>]
      | [EventName, EventCallback<EventNames>]
  ): void {
    switch (rest.length) {
      case 1:
        this._delete(this._manies, anyEvent, rest[0]);
        break;
      case 2:
        this._delete(this._manies, rest[0], rest[1]);
        break;
      default:
        throw new TypeError("Wrong number of arguments.");
    }
  }

  public once<EventName extends keyof EventPayloads>(
    eventName?: EventName
  ): Promise<EventNamePayloadPair> {
    return new Promise<any>((resolve, reject): void => {
      this._rejectOnKill.add(reject);
      this._push(this._onces, eventName || anyEvent, resolve);
    });
  }

  private _push(
    map: Map<string | typeof anyEvent, EventCallback<keyof EventPayloads>[]>,
    key: string | typeof anyEvent,
    callback: EventCallback<keyof EventPayloads>
  ): () => void {
    const original = map.get(key);

    if (original != null) {
      original.push(callback);
    } else {
      const created: EventCallback<keyof EventPayloads>[] = [callback];
      map.set(key, created);
    }

    return this._delete.bind(this, map, key, callback);
  }

  private _delete(
    map: Map<string | typeof anyEvent, EventCallback<keyof EventPayloads>[]>,
    key: string | typeof anyEvent,
    callback: EventCallback<keyof EventPayloads>
  ): void {
    const original = map.get(key);

    if (original != null) {
      original.splice(original.indexOf(callback), 1);
      if (original.length === 0) {
        map.delete(key);
      }
    }
  }
}
