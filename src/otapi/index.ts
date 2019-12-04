import {
  endSimulation,
  infoPanel,
  startSimulation,
  terminateApplication
} from "./requests";
import { off, offAny, on, onAny, once, onceAny } from "./responses";

import { Config } from "./config";

export {
  AnyEventCallback,
  EventCallback,
  EventNames,
  EventPayloads
} from "./responses";

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

  /*
   * Requests
   */

  public infoPanel(
    ...rest: Parameters<typeof infoPanel>
  ): ReturnType<typeof infoPanel> {
    return infoPanel.apply(this.config, rest);
  }
  public startSimulation(
    ...rest: Parameters<typeof startSimulation>
  ): ReturnType<typeof startSimulation> {
    return startSimulation.apply(this.config, rest);
  }
  public stopSimulation(
    ...rest: Parameters<typeof endSimulation>
  ): ReturnType<typeof endSimulation> {
    return endSimulation.apply(this.config, rest);
  }
  public terminateApplication(
    ...rest: Parameters<typeof terminateApplication>
  ): ReturnType<typeof terminateApplication> {
    return terminateApplication.apply(this.config, rest);
  }

  /*
   * Responses
   */

  public off(...rest: Parameters<typeof off>): ReturnType<typeof off> {
    return off.apply(this.config, rest);
  }
  public offAny(...rest: Parameters<typeof offAny>): ReturnType<typeof offAny> {
    return offAny.apply(this.config, rest);
  }
  public on(...rest: Parameters<typeof on>): ReturnType<typeof on> {
    return on.apply(this.config, rest);
  }
  public onAny(...rest: Parameters<typeof onAny>): ReturnType<typeof onAny> {
    return onAny.apply(this.config, rest);
  }
  public once(...rest: Parameters<typeof once>): ReturnType<typeof once> {
    return once.apply(this.config, rest);
  }
  public onceAny(
    ...rest: Parameters<typeof onceAny>
  ): ReturnType<typeof onceAny> {
    return onceAny.apply(this.config, rest);
  }
}
