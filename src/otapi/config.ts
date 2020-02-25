export interface Config {
  host: string;
  keepAlive: boolean;
  portApp: number;
  portOT: number;
  protocol: "http" | "https";
}
