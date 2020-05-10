import axiosStatic, { AxiosInstance } from "axios";
import {
  HttpOptions as HTTPAgentOptions,
  HttpsAgent as HTTPSAgent,
  HttpsOptions as HTTPSAgentOptions,
  default as HTTPAgent,
} from "agentkeepalive";

import { Config } from "../config";
import { SendParameters } from "./parameters";
import { retry } from "../util";

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
  return `${config.protocolOT}://${config.hostOT}:${config.portOT}/otd`;
}

const escapesXMLAttribute = new Map([
  ["&", "&amp;"],
  ["'", "&apos;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
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

export function send<Name extends keyof SendParameters>(
  config: Config,
  name: Name,
  parameters: SendParameters[Name],
  retryFailed: boolean
): { result: Promise<void>; cancel: (error?: Error) => void } {
  const data = buildBody(name, parsePayload(parameters));

  config.communicationLog.logRequest(data);

  if (retryFailed) {
    const { result, cancel } = retry(
      config.log("send"),
      async (): Promise<void> => {
        await config.axios.post(getURL(config), data);
      },
      config.retry
    );

    return {
      result: (async (): Promise<void> => {
        try {
          await result;
        } catch (error) {
          config
            .log("send")
            .error(
              error,
              [`Failed to send request (${new Date()}):`, data].join("\n")
            );

          throw error;
        }
      })(),
      cancel,
    };
  } else {
    return {
      result: (async (): Promise<void> => {
        await config.axios.post(getURL(config), data);
      })(),
      cancel(): void {},
    };
  }
}

export function createAxios({
  keepAlive,
  maxSimultaneousRequests: maxSockets,
}: {
  keepAlive: boolean;
  maxSimultaneousRequests: number;
}): AxiosInstance {
  const timeout = 15 * 1000;

  const agentOptions: HTTPAgentOptions & HTTPSAgentOptions = {
    keepAlive,
    maxSockets,
    timeout,
  };

  const keepAliveHeaders = keepAlive
    ? {
        Connection: "keep-alive",
        "Keep-Alive": `timeout=${Math.ceil(timeout / 1000 + 15)}, max=${
          Number.MAX_SAFE_INTEGER
        }`,
      }
    : {
        Connection: "close",
      };

  const axios = axiosStatic.create({
    httpAgent: new HTTPAgent(agentOptions),
    httpsAgent: new HTTPSAgent(agentOptions),

    timeout,

    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      ...keepAliveHeaders,
    },
    responseType: "text",
  });

  return axios;
}
