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
  SendParameters,
  createAxios,
} from "./requests";
import {
  EventCallback,
  EventNamePayloadPair,
  EventPayloads,
  ResponseManager,
} from "./responses";
import { Config } from "./config";
import { RateLimiter } from "./util";
import { curryLog, CurryLog } from "../curry-log";
import {
  CommunicationDumpsterLogger,
  CommunicationFileLogger,
} from "./communication-logger";

export {
  AnyEventCallback,
  EventCallback,
  EventNames,
  EventPayloads,
} from "./responses";

export * from "./runfile";

export * from "./functions";

export interface OTAPIConstructorParams {
  communicationLog?: null | string | Config["communicationLog"];
  hostOT?: Config["hostOT"];
  keepAlive?: Config["keepAlive"];
  log?: CurryLog;
  maxSimultaneousRequests?: Config["maxSimultaneousRequests"];
  portApp?: Config["portApp"];
  portOT?: Config["portOT"];
  protocolOT?: Config["protocolOT"];
  retry?: number;
}

const defaultConstructorParams: Required<OTAPIConstructorParams> = {
  communicationLog: null,
  hostOT: "localhost",
  keepAlive: false,
  log: curryLog().get("OTAPI"),
  maxSimultaneousRequests: 1,
  portApp: 9004,
  portOT: 9002,
  protocolOT: "http",
  retry: 5,
};

export interface SendInPauseAPI {
  send<Name extends keyof SendParameters>(
    name: Name,
    parameters: SendParameters[Name]
  ): void;
}

export class OTAPIKilledError extends Error {
  public constructor(msg: string) {
    super(msg);
  }
}

export class OTAPI {
  private readonly _responseManager: ResponseManager;
  private readonly _limiter: RateLimiter;
  private readonly _callOnKill = new Set<() => void>();

  private readonly _failureCallbacks = new Map<symbol, () => void>();

  private _pausedBy = 0;
  private _paused: null | Promise<unknown> = null;

  private _killed: null | Error = null;

  public readonly config: Config;

  public constructor(constructorParams: OTAPIConstructorParams) {
    const constructorParamsWithDefaults: Required<OTAPIConstructorParams> = {
      ...defaultConstructorParams,
      ...constructorParams,
    };

    const log = constructorParamsWithDefaults.log;

    const communicationLog =
      typeof constructorParams.communicationLog === "string"
        ? new CommunicationFileLogger(
            log("communication"),
            constructorParams.communicationLog
          )
        : constructorParams.communicationLog
        ? constructorParams.communicationLog
        : new CommunicationDumpsterLogger();

    this.config = Object.freeze<Config>({
      ...constructorParamsWithDefaults,
      axios: createAxios(constructorParamsWithDefaults),
      communicationLog,
    });

    this._limiter = new RateLimiter(this.config.maxSimultaneousRequests);
    this._responseManager = new ResponseManager(
      log("response-manager"),
      this.config
    );
  }

  /*
   * Lifecycle
   */
  public start(): Promise<void> {
    this._throwIfKilled();

    return this._responseManager.start();
  }
  public stop(): Promise<void> {
    this._throwIfKilled();

    return this._responseManager.stop();
  }
  public kill(
    error = new OTAPIKilledError("This OTAPI session has been killed.")
  ): Promise<void> {
    this._killed = error;

    for (const func of this._callOnKill) {
      func();
    }
    return this._responseManager.kill(error);
  }
  private _throwIfKilled(): void | never {
    if (this._killed) {
      throw this._killed;
    }
  }

  /*
   * Requests
   */

  private _send<Name extends keyof SendParameters>(
    name: Name,
    parameters: SendParameters[Name],
    retryFailed: boolean
  ): Promise<void> {
    return this._limiter.run(
      async (): Promise<void> => {
        // If a request was planned before kill but didn't start yet, it
        // shouldn't be started at all.
        this._throwIfKilled();

        const { result, cancel } = send(
          this.config,
          name,
          parameters,
          retryFailed
        );

        this._callOnKill.add(cancel);
        try {
          await result;
        } catch (error) {
          if (this._killed == null) {
            for (const callback of this._failureCallbacks.values()) {
              callback();
            }
          }
          throw error;
        }
        this._callOnKill.delete(cancel);

        return result;
      }
    );
  }

  public async send<Name extends keyof SendParameters>(
    name: Name,
    parameters: SendParameters[Name],
    retryFailed = true
  ): Promise<void> {
    this._throwIfKilled();

    return this._send(name, parameters, retryFailed);
  }

  public async sendInPause(
    func: (send: SendInPauseAPI) => void | Promise<void>
  ): Promise<void> {
    this._throwIfKilled();

    const requests: (() => Promise<void>)[] = [];
    await func({
      send: (...rest): void => {
        requests.push(this.send.bind(this, ...rest));
      },
    });

    if (requests.length === 0) {
      return;
    }

    this.pauseFor(
      async (): Promise<void> => {
        await Promise.all(requests.map((func): Promise<void> => func()));
      }
    );
  }

  public async pauseFor(func: () => void | Promise<void>): Promise<void> {
    this._throwIfKilled();

    ++this._pausedBy;
    if (this._pausedBy === 1) {
      this._paused = this.once("simPaused");
      await this.pauseSimulation();
    }
    await this._paused;

    try {
      await func();
    } catch (error) {
      this.config.log.error(
        error,
        "OpenTrack was paused for this function but it thrown an error."
      );
    }

    --this._pausedBy;
    if (this._pausedBy === 0) {
      this._paused = null;
      await this.startSimulation();
    }
  }

  public activateTrain(parameters: ActivateTrainParameters): Promise<void> {
    return this.send("activateTrain", parameters);
  }
  public addTimetableEntry(
    parameters: AddTimetableEntryParameters
  ): Promise<void> {
    return this.send("addTimetableEntry", parameters);
  }
  public addTrain(parameters: AddTrainParameters): Promise<void> {
    return this.send("addTrain", parameters);
  }
  public cancelConnection(
    parameters: CancelConnectionParameters
  ): Promise<void> {
    return this.send("cancelConnection", parameters);
  }
  public cancelRoute(parameters: CancelRouteParameters): Promise<void> {
    return this.send("cancelRoute", parameters);
  }
  public deactivateTrain(parameters: DeactivateTrainParameters): Promise<void> {
    return this.send("deactivateTrain", parameters);
  }
  public endSimulation(
    parameters: EndSimulationParameters = {}
  ): Promise<void> {
    return this.send("endSimulation", parameters);
  }
  public infoPanel(parameters: InfoPanelParameters = {}): Promise<void> {
    return this.send("infoPanel", parameters);
  }
  public openSimulationPanel(
    parameters: OpenSimulationPanelParameters = {}
  ): Promise<void> {
    return this.send("openSimulationPanel", parameters);
  }
  public pauseSimulation(
    parameters: PauseSimulationParameters = {}
  ): Promise<void> {
    return this.send("pauseSimulation", parameters);
  }
  public removeTrain(parameters: RemoveTrainParameters): Promise<void> {
    return this.send("removeTrain", parameters);
  }
  public resetMovementAuthority(
    parameters: ResetMovementAuthorityParameters
  ): Promise<void> {
    return this.send("resetMovementAuthority", parameters);
  }
  public resetRequestedDeceleration(
    parameters: ResetRequestedDecelerationParameters
  ): Promise<void> {
    return this.send("resetRequestedDeceleration", parameters);
  }
  public resetRequestedSpeed(
    parameters: ResetRequestedSpeedParameters
  ): Promise<void> {
    return this.send("resetRequestedSpeed", parameters);
  }
  public resetTimetable(
    parameters: ResetTimetableParameters = {}
  ): Promise<void> {
    return this.send("resetTimetable", parameters);
  }
  public setArrivalTime(parameters: SetArrivalTimeParameters): Promise<void> {
    return this.send("setArrivalTime", parameters);
  }
  public setConnection(parameters: SetConnectionParameters): Promise<void> {
    return this.send("setConnection", parameters);
  }
  public setDelayScenario(
    parameters: SetDelayScenarioParameters
  ): Promise<void> {
    return this.send("setDelayScenario", parameters);
  }
  public setDepartureCommand(
    parameters: SetDepartureCommandParameters
  ): Promise<void> {
    return this.send("setDepartureCommand", parameters);
  }
  public setDepartureTime(
    parameters: SetDepartureTimeParameters
  ): Promise<void> {
    return this.send("setDepartureTime", parameters);
  }
  public setDwellTime(parameters: SetDwellTimeParameters): Promise<void> {
    return this.send("setDwellTime", parameters);
  }
  public setEngineSwitch(parameters: SetEngineSwitchParameters): Promise<void> {
    return this.send("setEngineSwitch", parameters);
  }
  public setMovementAuthority(
    parameters: SetMovementAuthorityParameters
  ): Promise<void> {
    return this.send("setMovementAuthority", parameters);
  }
  public setPassingTime(parameters: SetPassingTimeParameters): Promise<void> {
    return this.send("setPassingTime", parameters);
  }
  public setPerformance(parameters: SetPerformanceParameters): Promise<void> {
    return this.send("setPerformance", parameters);
  }
  public setPositionCoasting(
    parameters: SetPositionCoastingParameters
  ): Promise<void> {
    return this.send("setPositionCoasting", parameters);
  }
  public setPositionSpeed(
    parameters: SetPositionSpeedParameters
  ): Promise<void> {
    return this.send("setPositionSpeed", parameters);
  }
  public setPriorityOfStartItinerary(
    parameters: SetPriorityOfStartItineraryParameters
  ): Promise<void> {
    return this.send("setPriorityOfStartItinerary", parameters);
  }
  public setRequestedDeceleration(
    parameters: SetRequestedDecelerationParameters
  ): Promise<void> {
    return this.send("setRequestedDeceleration", parameters);
  }
  public setRequestedSpeed(
    parameters: SetRequestedSpeedParameters
  ): Promise<void> {
    return this.send("setRequestedSpeed", parameters);
  }
  public setRouteAllowed(parameters: SetRouteAllowedParameters): Promise<void> {
    return this.send("setRouteAllowed", parameters);
  }
  public setRouteDisallowed(
    parameters: SetRouteDisallowedParameters
  ): Promise<void> {
    return this.send("setRouteDisallowed", parameters);
  }
  public setRouteReserve(parameters: SetRouteReserveParameters): Promise<void> {
    return this.send("setRouteReserve", parameters);
  }
  public setSendPositionReports(
    parameters: SetSendPositionReportsParameters
  ): Promise<void> {
    return this.send("setSendPositionReports", parameters);
  }
  public setSimulationEndTime(
    parameters: SetSimulationEndTimeParameters
  ): Promise<void> {
    return this.send("setSimulationEndTime", parameters);
  }
  public setSimulationPauseTime(
    parameters: SetSimulationPauseTimeParameters
  ): Promise<void> {
    return this.send("setSimulationPauseTime", parameters);
  }
  public setSimulationRate(
    parameters: SetSimulationRateParameters
  ): Promise<void> {
    return this.send("setSimulationRate", parameters);
  }
  public setSimulationStartTime(
    parameters: SetSimulationStartTimeParameters
  ): Promise<void> {
    return this.send("setSimulationStartTime", parameters);
  }
  public setSimulationStep(
    parameters: SetSimulationStepParameters
  ): Promise<void> {
    return this.send("setSimulationStep", parameters);
  }
  public setStop(parameters: SetStopParameters): Promise<void> {
    return this.send("setStop", parameters);
  }
  public setTerminalStation(
    parameters: SetTerminalStationParameters
  ): Promise<void> {
    return this.send("setTerminalStation", parameters);
  }
  public setWaitForDepartureCommand(
    parameters: SetWaitForDepartureCommandParameters
  ): Promise<void> {
    return this.send("setWaitForDepartureCommand", parameters);
  }
  public startSimulation(
    parameters: StartSimulationParameters = {}
  ): Promise<void> {
    return this.send("startSimulation", parameters);
  }
  public stepSimulation(
    parameters: StepSimulationParameters = {}
  ): Promise<void> {
    return this.send("stepSimulation", parameters);
  }
  public terminateApplication(
    parameters: TerminateApplicationParameters = {}
  ): Promise<void> {
    return this.send("terminateApplication", parameters);
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
    this._throwIfKilled();

    return this._responseManager.on(...rest);
  }

  public once<EventName extends keyof EventPayloads>(
    eventName?: EventName
  ): Promise<EventNamePayloadPair> {
    this._throwIfKilled();

    if (eventName != null) {
      return this._responseManager.once(eventName);
    } else {
      return this._responseManager.once();
    }
  }

  public onFailure(callback: () => void): () => void {
    this._throwIfKilled();

    const id = Symbol();

    this._failureCallbacks.set(id, callback);

    return (): void => {
      this._failureCallbacks.delete(id);
    };
  }
}
