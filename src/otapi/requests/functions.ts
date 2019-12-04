// vim:fdm=syntax

import { Config, send } from "./common";

export function endSimulation(this: Config): ReturnType<typeof send> {
  return send.call(this, `<endSimulation/>`);
}
export function infoPanel(this: Config): ReturnType<typeof send> {
  return send.call(this, `<infoPanel/>`);
}
export function startSimulation(this: Config): ReturnType<typeof send> {
  return send.call(this, `<startSimulation/>`);
}
export function terminateApplication(this: Config): ReturnType<typeof send> {
  return send.call(this, `<terminateApplication/>`);
}
