import bodyParser from "body-parser";
import express, { Express } from "express";
import xml2js from "xml2js";
import { Config } from "../config";
import { Server } from "http";

export interface Content {
  attributes: Record<string, string>;
  name: string;
  xml: any;
}
export type SOAPListener = (content: Content) => void;

const xmlParser = new xml2js.Parser();
async function processSOAP(soapText: string): Promise<Content> {
  const soapXML = await xmlParser.parseStringPromise(soapText);

  // There will never be less or more than one element in the body of a valid
  // SOAP message. If the input is not valid let's just crash for now.
  const xml = soapXML["SOAP-ENV:Envelope"]["SOAP-ENV:Body"][0];
  const name = Object.keys(xml)[0];
  const attributes = xml.$;

  return {
    attributes,
    name,
    xml
  };
}

const alses = new Map<
  number,
  { app: Express; listeners: SOAPListener[]; server: Server }
>();

export function addListener(
  this: Config,
  callback: SOAPListener
): Promise<void> {
  return new Promise((resolve, reject): void => {
    const port = this.portApp;

    const als = alses.get(port);
    if (als) {
      als.listeners.push(callback);
      resolve();
    } else {
      const app = express();
      const listeners = [callback];

      app.use(
        bodyParser.text({
          type: (): boolean => true,
          limit: "5mb"
        })
      );

      app.post("/otd", (req, _res): void => {
        listeners.forEach(
          async (callback): Promise<void> => {
            callback(await processSOAP(req.body));
          }
        );
      });

      alses.set(port, {
        app,
        listeners,
        server: app.listen(port, (e): void => void (e ? reject(e) : resolve()))
      });
    }
  });
}

export function removeListener(
  this: Config,
  callback: SOAPListener
): Promise<void> {
  return new Promise((resolve, reject): void => {
    const port = this.portApp;

    const als = alses.get(port);
    if (als) {
      const { listeners, server } = als;
      listeners.splice(listeners.indexOf(callback), 1);

      if (listeners.length === 0) {
        alses.delete(port);
        server.close((e): void => void (e ? reject(e) : resolve()));
      } else {
        resolve();
      }
    } else {
      resolve();
    }
  });
}
