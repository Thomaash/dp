import fetch from "node-fetch";
import { Config } from "../config";

export { Config };

function getURL(this: Config): string {
  return `${this.protocol}://${this.host}:${this.portOT}/otd`;
}

const escapesXMLAttribute = new Map([
  ["&", "&amp;"],
  ["'", "&apos;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"]
]);
function escapeXMLAttribute(value: string): string {
  return value
    .split("")
    .map((character): string => escapesXMLAttribute.get(character) || character)
    .join("");
}

function buildBody(
  tagName: string,
  attributes: {
    name: string;
    value: undefined | null | boolean | number | string;
  }[]
): string {
  const xmlAttributes = attributes
    .filter(({ value }): boolean => value != null)
    .map(
      ({ name, value }): string =>
        `${name}="${
          typeof value === "string" ? escapeXMLAttribute(value) : value
        }"`
    );

  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <${tagName} ${xmlAttributes.join(" ")} />
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

export async function sendSimpleRequest(
  this: Config,
  name: string,
  attributes: {
    name: string;
    value: undefined | null | boolean | number | string;
  }[]
): Promise<void> {
  const body = buildBody(name, attributes);

  try {
    await fetch(getURL.call(this), {
      body,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        connection: "close"
      },
      method: "POST",
      timeout: 5000
    });
  } catch (error) {
    console.error(
      ["", `Failed to send request (${new Date()}):`, body, ""].join("\n")
    );

    throw error;
  }
}
