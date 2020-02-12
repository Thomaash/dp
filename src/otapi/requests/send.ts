import fetch from "node-fetch";
import { Config } from "../config";
import { SendParameters } from "./parameters";

export type SendPayload = Record<
  string,
  undefined | null | boolean | number | string
>;
interface SendOptAttribute {
  name: string;
  value: undefined | null | boolean | number | string;
}
interface SendAttribute {
  name: string;
  value: boolean | number | string;
}

function isntOptAttribute(value: SendOptAttribute): value is SendAttribute {
  return value.value != null;
}

function getURL(config: Config): string {
  return `${config.protocol}://${config.host}:${config.portOT}/otd`;
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

function parsePayload(payload: object): SendAttribute[] {
  return Object.entries(payload)
    .map(([name, value]): SendOptAttribute => ({ name, value }))
    .filter(isntOptAttribute);
}

function buildBody(tagName: string, attributes: SendAttribute[]): string {
  const xmlAttributes = attributes.map(
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

export async function send<Name extends keyof SendParameters>(
  config: Config,
  name: Name,
  parameters: SendParameters[Name]
): Promise<void> {
  const body = buildBody(name, parsePayload(parameters));

  try {
    await fetch(getURL(config), {
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
