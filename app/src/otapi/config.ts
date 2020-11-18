import { AxiosInstance } from "axios";

import { CurryLog } from "../curry-log";

import { CommunicationLogger } from "./communication-logger";

export interface Config {
  axios: AxiosInstance;
  communicationLog: CommunicationLogger;
  hostOT: string;
  keepAlive: boolean;
  log: CurryLog;
  maxSimultaneousRequests: number;
  portApp: number;
  portOT: number;
  protocolOT: "http" | "https";
  retry: number;
}
