import fetch from "node-fetch";
import { Config } from "../config";

export { Config };

function getURL(this: Config): string {
  return `${this.protocol}://${this.host}:${this.portOT}/otd`;
}

export async function sendSimpleRequest(
  this: Config,
  name: string,
  attributes: {
    name: string;
    value: undefined | null | boolean | number | string;
  }[]
): Promise<void> {
  await fetch(getURL.call(this), {
    body: `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <${name} ${attributes
      .filter(({ value }): boolean => value != null)
      .map(
        ({ name, value }): string =>
          `${name}="${
            typeof value === "string"
              ? value
                  .replace(/"/g, "&quot;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/&/g, "&amp;")
              : value
          }"`
      )} />
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`,

    method: "POST",
    timeout: 5000,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      connection: "close"
    }
  });
}
