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
  send,
  SendParameters
} from "./requests";
import {
  EventCallback,
  EventNamePayloadPair,
  EventPayloads,
  ResponseManager
} from "./responses";
import { Config } from "./config";
import { RateLimiter } from "./util";

export {
  AnyEventCallback,
  EventCallback,
  EventNames,
  EventPayloads
} from "./responses";

export * from "./runfile";

export interface OTAPIConstructorParams {
  host?: string;
  keepAlive?: boolean;
  maxSimultaneousRequests?: number;
  portApp?: number;
  portOT?: number;
  protocol?: "http" | "https";
}

const defaultConstructorParams: Required<OTAPIConstructorParams> = {
  host: "localhost",
  keepAlive: false,
  maxSimultaneousRequests: Number.POSITIVE_INFINITY,
  portApp: 9004,
  portOT: 9002,
  protocol: "http"
};

export class OTAPI {
  private readonly _responseManager: ResponseManager;
  private readonly _limiter: RateLimiter;
  private readonly _callOnKill = new Set<() => void>();

  public readonly config: Config;

  public constructor(constructorParams: OTAPIConstructorParams) {
    const params: Required<OTAPIConstructorParams> = Object.freeze({
      ...defaultConstructorParams,
      ...constructorParams
    });

    this.config = Object.freeze<Config>({
      host: params.host,
      keepAlive: params.keepAlive,
      portApp: params.portApp,
      portOT: params.portOT,
      protocol: params.protocol
    });

    this._limiter = new RateLimiter(params.maxSimultaneousRequests);
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
    for (const func of this._callOnKill) {
      func();
    }
    return this._responseManager.kill();
  }

  /*
   * Requests
   */

  private _send<Name extends keyof SendParameters>(
    name: Name,
    parameters: SendParameters[Name]
  ): Promise<void> {
    return this._limiter.run(
      async (): Promise<void> => {
        const { result, cancel } = send(this.config, name, parameters);

        this._callOnKill.add(cancel);
        await result;
        this._callOnKill.delete(cancel);

        return result;
      }
    );
  }

  public activateTrain(parameters: ActivateTrainParameters): Promise<void> {
    return this._send("activateTrain", parameters);
  }
  public addTimetableEntry(
    parameters: AddTimetableEntryParameters
  ): Promise<void> {
    return this._send("addTimetableEntry", parameters);
  }
  public addTrain(parameters: AddTrainParameters): Promise<void> {
    return this._send("addTrain", parameters);
  }
  public cancelConnection(
    parameters: CancelConnectionParameters
  ): Promise<void> {
    return this._send("cancelConnection", parameters);
  }
  public cancelRoute(parameters: CancelRouteParameters): Promise<void> {
    return this._send("cancelRoute", parameters);
  }
  public deactivateTrain(parameters: DeactivateTrainParameters): Promise<void> {
    return this._send("deactivateTrain", parameters);
  }
  public endSimulation(
    parameters: EndSimulationParameters = {}
  ): Promise<void> {
    return this._send("endSimulation", parameters);
  }
  public infoPanel(parameters: InfoPanelParameters = {}): Promise<void> {
    return this._send("infoPanel", parameters);
  }
  public openSimulationPanel(
    parameters: OpenSimulationPanelParameters = {}
  ): Promise<void> {
    return this._send("openSimulationPanel", parameters);
  }
  public pauseSimulation(
    parameters: PauseSimulationParameters = {}
  ): Promise<void> {
    return this._send("pauseSimulation", parameters);
  }
  public removeTrain(parameters: RemoveTrainParameters): Promise<void> {
    return this._send("removeTrain", parameters);
  }
  public resetMovementAuthority(
    parameters: ResetMovementAuthorityParameters
  ): Promise<void> {
    return this._send("resetMovementAuthority", parameters);
  }
  public resetRequestedDeceleration(
    parameters: ResetRequestedDecelerationParameters
  ): Promise<void> {
    return this._send("resetRequestedDeceleration", parameters);
  }
  public resetRequestedSpeed(
    parameters: ResetRequestedSpeedParameters
  ): Promise<void> {
    return this._send("resetRequestedSpeed", parameters);
  }
  public resetTimetable(
    parameters: ResetTimetableParameters = {}
  ): Promise<void> {
    return this._send("resetTimetable", parameters);
  }
  public setArrivalTime(parameters: SetArrivalTimeParameters): Promise<void> {
    return this._send("setArrivalTime", parameters);
  }
  public setConnection(parameters: SetConnectionParameters): Promise<void> {
    return this._send("setConnection", parameters);
  }
  public setDelayScenario(
    parameters: SetDelayScenarioParameters
  ): Promise<void> {
    return this._send("setDelayScenario", parameters);
  }
  public setDepartureCommand(
    parameters: SetDepartureCommandParameters
  ): Promise<void> {
    return this._send("setDepartureCommand", parameters);
  }
  public setDepartureTime(
    parameters: SetDepartureTimeParameters
  ): Promise<void> {
    return this._send("setDepartureTime", parameters);
  }
  public setDwellTime(parameters: SetDwellTimeParameters): Promise<void> {
    return this._send("setDwellTime", parameters);
  }
  public setEngineSwitch(parameters: SetEngineSwitchParameters): Promise<void> {
    return this._send("setEngineSwitch", parameters);
  }
  public setMovementAuthority(
    parameters: SetMovementAuthorityParameters
  ): Promise<void> {
    return this._send("setMovementAuthority", parameters);
  }
  public setPassingTime(parameters: SetPassingTimeParameters): Promise<void> {
    return this._send("setPassingTime", parameters);
  }
  public setPerformance(parameters: SetPerformanceParameters): Promise<void> {
    return this._send("setPerformance", parameters);
  }
  public setPositionCoasting(
    parameters: SetPositionCoastingParameters
  ): Promise<void> {
    return this._send("setPositionCoasting", parameters);
  }
  public setPositionSpeed(
    parameters: SetPositionSpeedParameters
  ): Promise<void> {
    return this._send("setPositionSpeed", parameters);
  }
  public setPriorityOfStartItinerary(
    parameters: SetPriorityOfStartItineraryParameters
  ): Promise<void> {
    return this._send("setPriorityOfStartItinerary", parameters);
  }
  public setRequestedDeceleration(
    parameters: SetRequestedDecelerationParameters
  ): Promise<void> {
    return this._send("setRequestedDeceleration", parameters);
  }
  public setRequestedSpeed(
    parameters: SetRequestedSpeedParameters
  ): Promise<void> {
    return this._send("setRequestedSpeed", parameters);
  }
  public setRouteAllowed(parameters: SetRouteAllowedParameters): Promise<void> {
    return this._send("setRouteAllowed", parameters);
  }
  public setRouteDisallowed(
    parameters: SetRouteDisallowedParameters
  ): Promise<void> {
    return this._send("setRouteDisallowed", parameters);
  }
  public setRouteReserve(parameters: SetRouteReserveParameters): Promise<void> {
    return this._send("setRouteReserve", parameters);
  }
  public setSendPositionReports(
    parameters: SetSendPositionReportsParameters
  ): Promise<void> {
    return this._send("setSendPositionReports", parameters);
  }
  public setSimulationEndTime(
    parameters: SetSimulationEndTimeParameters
  ): Promise<void> {
    return this._send("setSimulationEndTime", parameters);
  }
  public setSimulationPauseTime(
    parameters: SetSimulationPauseTimeParameters
  ): Promise<void> {
    return this._send("setSimulationPauseTime", parameters);
  }
  public setSimulationRate(
    parameters: SetSimulationRateParameters
  ): Promise<void> {
    return this._send("setSimulationRate", parameters);
  }
  public setSimulationStartTime(
    parameters: SetSimulationStartTimeParameters
  ): Promise<void> {
    return this._send("setSimulationStartTime", parameters);
  }
  public setSimulationStep(
    parameters: SetSimulationStepParameters
  ): Promise<void> {
    return this._send("setSimulationStep", parameters);
  }
  public setStop(parameters: SetStopParameters): Promise<void> {
    return this._send("setStop", parameters);
  }
  public setTerminalStation(
    parameters: SetTerminalStationParameters
  ): Promise<void> {
    return this._send("setTerminalStation", parameters);
  }
  public setWaitForDepartureCommand(
    parameters: SetWaitForDepartureCommandParameters
  ): Promise<void> {
    return this._send("setWaitForDepartureCommand", parameters);
  }
  public startSimulation(
    parameters: StartSimulationParameters = {}
  ): Promise<void> {
    return this._send("startSimulation", parameters);
  }
  public stepSimulation(
    parameters: StepSimulationParameters = {}
  ): Promise<void> {
    return this._send("stepSimulation", parameters);
  }
  public terminateApplication(
    parameters: TerminateApplicationParameters = {}
  ): Promise<void> {
    return this._send("terminateApplication", parameters);
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
