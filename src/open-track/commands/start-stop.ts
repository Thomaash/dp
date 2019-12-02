import fetch, { Response } from "node-fetch";
import { Config } from "../config";

function getURL(this: Config): string {
  return `${this.protocol}://${this.host}:${this.portOT}/otd`;
}

function fetchOT(this: Config, body: string): Promise<Response> {
  console.log(
    getURL.call(this),
    `<?xml version="1.0" encoding="UTF-8"?>
      <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
        <SOAP-ENV:Body>
          ${body}
        </SOAP-ENV:Body>
      </SOAP-ENV:Envelope>`
  );
  return fetch(getURL.call(this), {
    body: `<?xml version="1.0" encoding="UTF-8"?>
      <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
        <SOAP-ENV:Body>
          ${body}
        </SOAP-ENV:Body>
      </SOAP-ENV:Envelope>`,

    method: "POST",
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      connection: "close"
    }
  });
}

export function startSimulation(this: Config): Promise<Response> {
  return fetchOT.call(this, `<startSimulation/>`);
}

export function stopSimulation(this: Config): Promise<Response> {
  return fetchOT.call(this, `<endSimulation/>`);
}
