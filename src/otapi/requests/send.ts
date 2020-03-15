import http from "http";
import https from "https";
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

const httpAgent = new http.Agent({
  keepAlive: false
});
const httpsAgent = new https.Agent({
  keepAlive: false
});
function getAgent(parsedURL: URL): http.Agent | https.Agent {
  if (parsedURL.protocol == "http:") {
    return httpAgent;
  } else {
    return httpsAgent;
  }
}

const httpKeepAliveAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000
});
const httpsKeepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000
});
function getKeepAliveAgent(parsedURL: URL): http.Agent | https.Agent {
  if (parsedURL.protocol == "http:") {
    return httpKeepAliveAgent;
  } else {
    return httpsKeepAliveAgent;
  }
}

export async function send<Name extends keyof SendParameters>(
  config: Config,
  name: Name,
  parameters: SendParameters[Name]
): Promise<void> {
  const body = buildBody(name, parsePayload(parameters));

  try {
    await fetch(getURL(config), {
      agent: config.keepAlive ? getKeepAliveAgent : getAgent,
      body,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Keep-Alive": "timeout=90000, max=1000",
        Connection: config.keepAlive ? "Keep-Alive" : "Close"
      },
      method: "POST",
      timeout: 90000
    });
  } catch (error) {
    console.error(
      ["", `Failed to send request (${new Date()}):`, body, ""].join("\n"),
      error,
      "\n"
    );

    throw error;
  }
}
