import { CommunicationLogger } from "./communication-logger";

export interface Config {
  communicationLog: CommunicationLogger;
  host: string;
  keepAlive: boolean;
  maxSimultaneousRequests: number;
  portApp: number;
  portOT: number;
  protocol: "http" | "https";
}
