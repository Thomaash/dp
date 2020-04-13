import { CurryLog } from "../curry-log";

import { CommunicationLogger } from "./communication-logger";

export interface Config {
  communicationLog: CommunicationLogger;
  host: string;
  keepAlive: boolean;
  log: CurryLog;
  maxSimultaneousRequests: number;
  portApp: number;
  portOT: number;
  protocol: "http" | "https";
}
