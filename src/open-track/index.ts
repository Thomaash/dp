import {
  addListener,
  once,
  removeListener,
  startSimulation,
  stopSimulation
} from "./commands";

import { Config } from "./config";

export interface OTAPIConstructorParams {
  host?: string;
  portApp?: number;
  portOT?: number;
  protocol?: "http" | "https";
}

const defaultConstructorParams: Required<OTAPIConstructorParams> = {
  host: "localhost",
  portApp: 9004,
  portOT: 9002,
  protocol: "http"
};

export class OTAPI {
  public readonly config: Config;

  public constructor({
    host = defaultConstructorParams.host,
    portApp = defaultConstructorParams.portApp,
    portOT = defaultConstructorParams.portOT,
    protocol = defaultConstructorParams.protocol
  }: OTAPIConstructorParams = defaultConstructorParams) {
    this.config = Object.freeze({ host, portApp, portOT, protocol });
  }

  public addListener(
    ...rest: Parameters<typeof addListener>
  ): ReturnType<typeof addListener> {
    return addListener.apply(this.config, rest);
  }

  public removeListener(
    ...rest: Parameters<typeof removeListener>
  ): ReturnType<typeof removeListener> {
    return removeListener.apply(this.config, rest);
  }

  public once(...rest: Parameters<typeof once>): ReturnType<typeof once> {
    return once.apply(this.config, rest);
  }

  public startSimulation(
    ...rest: Parameters<typeof startSimulation>
  ): ReturnType<typeof startSimulation> {
    return startSimulation.apply(this.config, rest);
  }

  public stopSimulation(
    ...rest: Parameters<typeof stopSimulation>
  ): ReturnType<typeof stopSimulation> {
    return stopSimulation.apply(this.config, rest);
  }
}
