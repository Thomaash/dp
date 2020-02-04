import {
  activateTrain,
  addTimetableEntry,
  addTrain,
  cancelConnection,
  cancelRoute,
  deactivateTrain,
  endSimulation,
  infoPanel,
  openSimulationPanel,
  pauseSimulation,
  removeTrain,
  resetMovementAuthority,
  resetRequestedDeceleration,
  resetRequestedSpeed,
  resetTimetable,
  setArrivalTime,
  setConnection,
  setDelayScenario,
  setDepartureCommand,
  setDepartureTime,
  setDwellTime,
  setEngineSwitch,
  setMovementAuthority,
  setPassingTime,
  setPerformance,
  setPositionCoasting,
  setPositionSpeed,
  setPriorityOfStartItinerary,
  setRequestedDeceleration,
  setRequestedSpeed,
  setRouteAllowed,
  setRouteDisallowed,
  setRouteReserve,
  setSendPositionReports,
  setSimulationEndTime,
  setSimulationPauseTime,
  setSimulationRate,
  setSimulationStartTime,
  setSimulationStep,
  setStop,
  setTerminalStation,
  setWaitForDepartureCommand,
  startSimulation,
  stepSimulation,
  terminateApplication
} from "./requests";
import { ResponseManager, EventCallback, EventPayloads } from "./responses";

import { Config } from "./config";
import { EventNamePayloadPair } from "./responses/manager";

export {
  AnyEventCallback,
  EventCallback,
  EventNames,
  EventPayloads
} from "./responses";

export * from "./runfile";

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
  private readonly _responseManager: ResponseManager;

  public readonly config: Config;

  public constructor({
    host = defaultConstructorParams.host,
    portApp = defaultConstructorParams.portApp,
    portOT = defaultConstructorParams.portOT,
    protocol = defaultConstructorParams.protocol
  }: OTAPIConstructorParams = defaultConstructorParams) {
    this.config = Object.freeze({ host, portApp, portOT, protocol });
    this._responseManager = new ResponseManager(this.config);
  }

  /*
   * Lifecycle
   */
  public start(): Promise<void> {
    return this._responseManager.start();
  }
  public stop(): Promise<void> {
    return this._responseManager.stop();
  }
  public kill(): Promise<void> {
    return this._responseManager.kill();
  }

  /*
   * Requests
   */

  public activateTrain(
    ...rest: Parameters<typeof activateTrain>
  ): ReturnType<typeof activateTrain> {
    return activateTrain.apply(this.config, rest);
  }
  public addTimetableEntry(
    ...rest: Parameters<typeof addTimetableEntry>
  ): ReturnType<typeof addTimetableEntry> {
    return addTimetableEntry.apply(this.config, rest);
  }
  public addTrain(
    ...rest: Parameters<typeof addTrain>
  ): ReturnType<typeof addTrain> {
    return addTrain.apply(this.config, rest);
  }
  public cancelConnection(
    ...rest: Parameters<typeof cancelConnection>
  ): ReturnType<typeof cancelConnection> {
    return cancelConnection.apply(this.config, rest);
  }
  public cancelRoute(
    ...rest: Parameters<typeof cancelRoute>
  ): ReturnType<typeof cancelRoute> {
    return cancelRoute.apply(this.config, rest);
  }
  public deactivateTrain(
    ...rest: Parameters<typeof deactivateTrain>
  ): ReturnType<typeof deactivateTrain> {
    return deactivateTrain.apply(this.config, rest);
  }
  public endSimulation(
    ...rest: Parameters<typeof endSimulation>
  ): ReturnType<typeof endSimulation> {
    return endSimulation.apply(this.config, rest);
  }
  public infoPanel(
    ...rest: Parameters<typeof infoPanel>
  ): ReturnType<typeof infoPanel> {
    return infoPanel.apply(this.config, rest);
  }
  public openSimulationPanel(
    ...rest: Parameters<typeof openSimulationPanel>
  ): ReturnType<typeof openSimulationPanel> {
    return openSimulationPanel.apply(this.config, rest);
  }
  public pauseSimulation(
    ...rest: Parameters<typeof pauseSimulation>
  ): ReturnType<typeof pauseSimulation> {
    return pauseSimulation.apply(this.config, rest);
  }
  public removeTrain(
    ...rest: Parameters<typeof removeTrain>
  ): ReturnType<typeof removeTrain> {
    return removeTrain.apply(this.config, rest);
  }
  public resetMovementAuthority(
    ...rest: Parameters<typeof resetMovementAuthority>
  ): ReturnType<typeof resetMovementAuthority> {
    return resetMovementAuthority.apply(this.config, rest);
  }
  public resetRequestedDeceleration(
    ...rest: Parameters<typeof resetRequestedDeceleration>
  ): ReturnType<typeof resetRequestedDeceleration> {
    return resetRequestedDeceleration.apply(this.config, rest);
  }
  public resetRequestedSpeed(
    ...rest: Parameters<typeof resetRequestedSpeed>
  ): ReturnType<typeof resetRequestedSpeed> {
    return resetRequestedSpeed.apply(this.config, rest);
  }
  public resetTimetable(
    ...rest: Parameters<typeof resetTimetable>
  ): ReturnType<typeof resetTimetable> {
    return resetTimetable.apply(this.config, rest);
  }
  public setArrivalTime(
    ...rest: Parameters<typeof setArrivalTime>
  ): ReturnType<typeof setArrivalTime> {
    return setArrivalTime.apply(this.config, rest);
  }
  public setConnection(
    ...rest: Parameters<typeof setConnection>
  ): ReturnType<typeof setConnection> {
    return setConnection.apply(this.config, rest);
  }
  public setDelayScenario(
    ...rest: Parameters<typeof setDelayScenario>
  ): ReturnType<typeof setDelayScenario> {
    return setDelayScenario.apply(this.config, rest);
  }
  public setDepartureCommand(
    ...rest: Parameters<typeof setDepartureCommand>
  ): ReturnType<typeof setDepartureCommand> {
    return setDepartureCommand.apply(this.config, rest);
  }
  public setDepartureTime(
    ...rest: Parameters<typeof setDepartureTime>
  ): ReturnType<typeof setDepartureTime> {
    return setDepartureTime.apply(this.config, rest);
  }
  public setDwellTime(
    ...rest: Parameters<typeof setDwellTime>
  ): ReturnType<typeof setDwellTime> {
    return setDwellTime.apply(this.config, rest);
  }
  public setEngineSwitch(
    ...rest: Parameters<typeof setEngineSwitch>
  ): ReturnType<typeof setEngineSwitch> {
    return setEngineSwitch.apply(this.config, rest);
  }
  public setMovementAuthority(
    ...rest: Parameters<typeof setMovementAuthority>
  ): ReturnType<typeof setMovementAuthority> {
    return setMovementAuthority.apply(this.config, rest);
  }
  public setPassingTime(
    ...rest: Parameters<typeof setPassingTime>
  ): ReturnType<typeof setPassingTime> {
    return setPassingTime.apply(this.config, rest);
  }
  public setPerformance(
    ...rest: Parameters<typeof setPerformance>
  ): ReturnType<typeof setPerformance> {
    return setPerformance.apply(this.config, rest);
  }
  public setPositionCoasting(
    ...rest: Parameters<typeof setPositionCoasting>
  ): ReturnType<typeof setPositionCoasting> {
    return setPositionCoasting.apply(this.config, rest);
  }
  public setPositionSpeed(
    ...rest: Parameters<typeof setPositionSpeed>
  ): ReturnType<typeof setPositionSpeed> {
    return setPositionSpeed.apply(this.config, rest);
  }
  public setPriorityOfStartItinerary(
    ...rest: Parameters<typeof setPriorityOfStartItinerary>
  ): ReturnType<typeof setPriorityOfStartItinerary> {
    return setPriorityOfStartItinerary.apply(this.config, rest);
  }
  public setRequestedDeceleration(
    ...rest: Parameters<typeof setRequestedDeceleration>
  ): ReturnType<typeof setRequestedDeceleration> {
    return setRequestedDeceleration.apply(this.config, rest);
  }
  public setRequestedSpeed(
    ...rest: Parameters<typeof setRequestedSpeed>
  ): ReturnType<typeof setRequestedSpeed> {
    return setRequestedSpeed.apply(this.config, rest);
  }
  public setRouteAllowed(
    ...rest: Parameters<typeof setRouteAllowed>
  ): ReturnType<typeof setRouteAllowed> {
    return setRouteAllowed.apply(this.config, rest);
  }
  public setRouteDisallowed(
    ...rest: Parameters<typeof setRouteDisallowed>
  ): ReturnType<typeof setRouteDisallowed> {
    return setRouteDisallowed.apply(this.config, rest);
  }
  public setRouteReserve(
    ...rest: Parameters<typeof setRouteReserve>
  ): ReturnType<typeof setRouteReserve> {
    return setRouteReserve.apply(this.config, rest);
  }
  public setSendPositionReports(
    ...rest: Parameters<typeof setSendPositionReports>
  ): ReturnType<typeof setSendPositionReports> {
    return setSendPositionReports.apply(this.config, rest);
  }
  public setSimulationEndTime(
    ...rest: Parameters<typeof setSimulationEndTime>
  ): ReturnType<typeof setSimulationEndTime> {
    return setSimulationEndTime.apply(this.config, rest);
  }
  public setSimulationPauseTime(
    ...rest: Parameters<typeof setSimulationPauseTime>
  ): ReturnType<typeof setSimulationPauseTime> {
    return setSimulationPauseTime.apply(this.config, rest);
  }
  public setSimulationRate(
    ...rest: Parameters<typeof setSimulationRate>
  ): ReturnType<typeof setSimulationRate> {
    return setSimulationRate.apply(this.config, rest);
  }
  public setSimulationStartTime(
    ...rest: Parameters<typeof setSimulationStartTime>
  ): ReturnType<typeof setSimulationStartTime> {
    return setSimulationStartTime.apply(this.config, rest);
  }
  public setSimulationStep(
    ...rest: Parameters<typeof setSimulationStep>
  ): ReturnType<typeof setSimulationStep> {
    return setSimulationStep.apply(this.config, rest);
  }
  public setStop(
    ...rest: Parameters<typeof setStop>
  ): ReturnType<typeof setStop> {
    return setStop.apply(this.config, rest);
  }
  public setTerminalStation(
    ...rest: Parameters<typeof setTerminalStation>
  ): ReturnType<typeof setTerminalStation> {
    return setTerminalStation.apply(this.config, rest);
  }
  public setWaitForDepartureCommand(
    ...rest: Parameters<typeof setWaitForDepartureCommand>
  ): ReturnType<typeof setWaitForDepartureCommand> {
    return setWaitForDepartureCommand.apply(this.config, rest);
  }
  public startSimulation(
    ...rest: Parameters<typeof startSimulation>
  ): ReturnType<typeof startSimulation> {
    return startSimulation.apply(this.config, rest);
  }
  public stepSimulation(
    ...rest: Parameters<typeof stepSimulation>
  ): ReturnType<typeof stepSimulation> {
    return stepSimulation.apply(this.config, rest);
  }
  public terminateApplication(
    ...rest: Parameters<typeof terminateApplication>
  ): ReturnType<typeof terminateApplication> {
    return terminateApplication.apply(this.config, rest);
  }

  /*
   * Responses
   */

  public off(callback: EventCallback<keyof EventPayloads>): void;
  public off<EventName extends keyof EventPayloads>(
    eventName: EventName,
    callback: EventCallback<EventName>
  ): void;
  public off(...rest: [any] | [any | any]): void {
    return this._responseManager.off(...rest);
  }

  public on(callback: EventCallback<keyof EventPayloads>): () => void;
  public on<EventName extends keyof EventPayloads>(
    eventName: EventName,
    callback: EventCallback<EventName>
  ): () => void;
  public on(...rest: [any] | [any | any]): () => void {
    return this._responseManager.on(...rest);
  }

  public once<EventName extends keyof EventPayloads>(
    eventName?: EventName
  ): Promise<EventNamePayloadPair> {
    if (eventName != null) {
      return this._responseManager.once(eventName);
    } else {
      return this._responseManager.once();
    }
  }
}
