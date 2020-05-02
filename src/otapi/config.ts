import { CurryLog } from "../curry-log";

import { CommunicationLogger } from "./communication-logger";

export interface Config {
  communicationLog: CommunicationLogger;
  hostOT: string;
  keepAlive: boolean;
  log: CurryLog;
  maxSimultaneousRequests: number;
  portApp: number;
  portOT: number;
  protocolOT: "http" | "https";
}
