import fetch from "node-fetch";
import { Config } from "../config";

export { Config };

function getURL(this: Config): string {
  return `${this.protocol}://${this.host}:${this.portOT}/otd`;
}

export async function send(this: Config, body: string): Promise<void> {
  await fetch(getURL.call(this), {
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
