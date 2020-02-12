import {
  ActivateTrainParameters,
  AddTimetableEntryParameters,
  AddTrainParameters,
  CancelConnectionParameters,
  CancelRouteParameters,
  DeactivateTrainParameters,
  EndSimulationParameters,
  InfoPanelParameters,
  OpenSimulationPanelParameters,
  PauseSimulationParameters,
  RemoveTrainParameters,
  ResetMovementAuthorityParameters,
  ResetRequestedDecelerationParameters,
  ResetRequestedSpeedParameters,
  ResetTimetableParameters,
  SetArrivalTimeParameters,
  SetConnectionParameters,
  SetDelayScenarioParameters,
  SetDepartureCommandParameters,
  SetDepartureTimeParameters,
  SetDwellTimeParameters,
  SetEngineSwitchParameters,
  SetMovementAuthorityParameters,
  SetPassingTimeParameters,
  SetPerformanceParameters,
  SetPositionCoastingParameters,
  SetPositionSpeedParameters,
  SetPriorityOfStartItineraryParameters,
  SetRequestedDecelerationParameters,
  SetRequestedSpeedParameters,
  SetRouteAllowedParameters,
  SetRouteDisallowedParameters,
  SetRouteReserveParameters,
  SetSendPositionReportsParameters,
  SetSimulationEndTimeParameters,
  SetSimulationPauseTimeParameters,
  SetSimulationRateParameters,
  SetSimulationStartTimeParameters,
  SetSimulationStepParameters,
  SetStopParameters,
  SetTerminalStationParameters,
  SetWaitForDepartureCommandParameters,
  StartSimulationParameters,
  StepSimulationParameters,
  TerminateApplicationParameters,
  send
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

  public activateTrain(parameters: ActivateTrainParameters): Promise<void> {
    return send(this.config, "activateTrain", parameters);
  }
  public addTimetableEntry(
    parameters: AddTimetableEntryParameters
  ): Promise<void> {
    return send(this.config, "addTimetableEntry", parameters);
  }
  public addTrain(parameters: AddTrainParameters): Promise<void> {
    return send(this.config, "addTrain", parameters);
  }
  public cancelConnection(
    parameters: CancelConnectionParameters
  ): Promise<void> {
    return send(this.config, "cancelConnection", parameters);
  }
  public cancelRoute(parameters: CancelRouteParameters): Promise<void> {
    return send(this.config, "cancelRoute", parameters);
  }
  public deactivateTrain(parameters: DeactivateTrainParameters): Promise<void> {
    return send(this.config, "deactivateTrain", parameters);
  }
  public endSimulation(
    parameters: EndSimulationParameters = {}
  ): Promise<void> {
    return send(this.config, "endSimulation", parameters);
  }
  public infoPanel(parameters: InfoPanelParameters = {}): Promise<void> {
    return send(this.config, "infoPanel", parameters);
  }
  public openSimulationPanel(
    parameters: OpenSimulationPanelParameters = {}
  ): Promise<void> {
    return send(this.config, "openSimulationPanel", parameters);
  }
  public pauseSimulation(
    parameters: PauseSimulationParameters = {}
  ): Promise<void> {
    return send(this.config, "pauseSimulation", parameters);
  }
  public removeTrain(parameters: RemoveTrainParameters): Promise<void> {
    return send(this.config, "removeTrain", parameters);
  }
  public resetMovementAuthority(
    parameters: ResetMovementAuthorityParameters
  ): Promise<void> {
    return send(this.config, "resetMovementAuthority", parameters);
  }
  public resetRequestedDeceleration(
    parameters: ResetRequestedDecelerationParameters
  ): Promise<void> {
    return send(this.config, "resetRequestedDeceleration", parameters);
  }
  public resetRequestedSpeed(
    parameters: ResetRequestedSpeedParameters
  ): Promise<void> {
    return send(this.config, "resetRequestedSpeed", parameters);
  }
  public resetTimetable(
    parameters: ResetTimetableParameters = {}
  ): Promise<void> {
    return send(this.config, "resetTimetable", parameters);
  }
  public setArrivalTime(parameters: SetArrivalTimeParameters): Promise<void> {
    return send(this.config, "setArrivalTime", parameters);
  }
  public setConnection(parameters: SetConnectionParameters): Promise<void> {
    return send(this.config, "setConnection", parameters);
  }
  public setDelayScenario(
    parameters: SetDelayScenarioParameters
  ): Promise<void> {
    return send(this.config, "setDelayScenario", parameters);
  }
  public setDepartureCommand(
    parameters: SetDepartureCommandParameters
  ): Promise<void> {
    return send(this.config, "setDepartureCommand", parameters);
  }
  public setDepartureTime(
    parameters: SetDepartureTimeParameters
  ): Promise<void> {
    return send(this.config, "setDepartureTime", parameters);
  }
  public setDwellTime(parameters: SetDwellTimeParameters): Promise<void> {
    return send(this.config, "setDwellTime", parameters);
  }
  public setEngineSwitch(parameters: SetEngineSwitchParameters): Promise<void> {
    return send(this.config, "setEngineSwitch", parameters);
  }
  public setMovementAuthority(
    parameters: SetMovementAuthorityParameters
  ): Promise<void> {
    return send(this.config, "setMovementAuthority", parameters);
  }
  public setPassingTime(parameters: SetPassingTimeParameters): Promise<void> {
    return send(this.config, "setPassingTime", parameters);
  }
  public setPerformance(parameters: SetPerformanceParameters): Promise<void> {
    return send(this.config, "setPerformance", parameters);
  }
  public setPositionCoasting(
    parameters: SetPositionCoastingParameters
  ): Promise<void> {
    return send(this.config, "setPositionCoasting", parameters);
  }
  public setPositionSpeed(
    parameters: SetPositionSpeedParameters
  ): Promise<void> {
    return send(this.config, "setPositionSpeed", parameters);
  }
  public setPriorityOfStartItinerary(
    parameters: SetPriorityOfStartItineraryParameters
  ): Promise<void> {
    return send(this.config, "setPriorityOfStartItinerary", parameters);
  }
  public setRequestedDeceleration(
    parameters: SetRequestedDecelerationParameters
  ): Promise<void> {
    return send(this.config, "setRequestedDeceleration", parameters);
  }
  public setRequestedSpeed(
    parameters: SetRequestedSpeedParameters
  ): Promise<void> {
    return send(this.config, "setRequestedSpeed", parameters);
  }
  public setRouteAllowed(parameters: SetRouteAllowedParameters): Promise<void> {
    return send(this.config, "setRouteAllowed", parameters);
  }
  public setRouteDisallowed(
    parameters: SetRouteDisallowedParameters
  ): Promise<void> {
    return send(this.config, "setRouteDisallowed", parameters);
  }
  public setRouteReserve(parameters: SetRouteReserveParameters): Promise<void> {
    return send(this.config, "setRouteReserve", parameters);
  }
  public setSendPositionReports(
    parameters: SetSendPositionReportsParameters
  ): Promise<void> {
    return send(this.config, "setSendPositionReports", parameters);
  }
  public setSimulationEndTime(
    parameters: SetSimulationEndTimeParameters
  ): Promise<void> {
    return send(this.config, "setSimulationEndTime", parameters);
  }
  public setSimulationPauseTime(
    parameters: SetSimulationPauseTimeParameters
  ): Promise<void> {
    return send(this.config, "setSimulationPauseTime", parameters);
  }
  public setSimulationRate(
    parameters: SetSimulationRateParameters
  ): Promise<void> {
    return send(this.config, "setSimulationRate", parameters);
  }
  public setSimulationStartTime(
    parameters: SetSimulationStartTimeParameters
  ): Promise<void> {
    return send(this.config, "setSimulationStartTime", parameters);
  }
  public setSimulationStep(
    parameters: SetSimulationStepParameters
  ): Promise<void> {
    return send(this.config, "setSimulationStep", parameters);
  }
  public setStop(parameters: SetStopParameters): Promise<void> {
    return send(this.config, "setStop", parameters);
  }
  public setTerminalStation(
    parameters: SetTerminalStationParameters
  ): Promise<void> {
    return send(this.config, "setTerminalStation", parameters);
  }
  public setWaitForDepartureCommand(
    parameters: SetWaitForDepartureCommandParameters
  ): Promise<void> {
    return send(this.config, "setWaitForDepartureCommand", parameters);
  }
  public startSimulation(
    parameters: StartSimulationParameters = {}
  ): Promise<void> {
    return send(this.config, "startSimulation", parameters);
  }
  public stepSimulation(
    parameters: StepSimulationParameters = {}
  ): Promise<void> {
    return send(this.config, "stepSimulation", parameters);
  }
  public terminateApplication(
    parameters: TerminateApplicationParameters = {}
  ): Promise<void> {
    return send(this.config, "terminateApplication", parameters);
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
