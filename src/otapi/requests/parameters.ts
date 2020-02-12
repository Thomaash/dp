export interface SendParameters {
  activateTrain: ActivateTrainParameters;
  addTimetableEntry: AddTimetableEntryParameters;
  addTrain: AddTrainParameters;
  cancelConnection: CancelConnectionParameters;
  cancelRoute: CancelRouteParameters;
  deactivateTrain: DeactivateTrainParameters;
  endSimulation: EndSimulationParameters;
  infoPanel: InfoPanelParameters;
  openSimulationPanel: OpenSimulationPanelParameters;
  pauseSimulation: PauseSimulationParameters;
  removeTrain: RemoveTrainParameters;
  resetMovementAuthority: ResetMovementAuthorityParameters;
  resetRequestedDeceleration: ResetRequestedDecelerationParameters;
  resetRequestedSpeed: ResetRequestedSpeedParameters;
  resetTimetable: ResetTimetableParameters;
  setArrivalTime: SetArrivalTimeParameters;
  setConnection: SetConnectionParameters;
  setDelayScenario: SetDelayScenarioParameters;
  setDepartureCommand: SetDepartureCommandParameters;
  setDepartureTime: SetDepartureTimeParameters;
  setDwellTime: SetDwellTimeParameters;
  setEngineSwitch: SetEngineSwitchParameters;
  setMovementAuthority: SetMovementAuthorityParameters;
  setPassingTime: SetPassingTimeParameters;
  setPerformance: SetPerformanceParameters;
  setPositionCoasting: SetPositionCoastingParameters;
  setPositionSpeed: SetPositionSpeedParameters;
  setPriorityOfStartItinerary: SetPriorityOfStartItineraryParameters;
  setRequestedDeceleration: SetRequestedDecelerationParameters;
  setRequestedSpeed: SetRequestedSpeedParameters;
  setRouteAllowed: SetRouteAllowedParameters;
  setRouteDisallowed: SetRouteDisallowedParameters;
  setRouteReserve: SetRouteReserveParameters;
  setSendPositionReports: SetSendPositionReportsParameters;
  setSimulationEndTime: SetSimulationEndTimeParameters;
  setSimulationPauseTime: SetSimulationPauseTimeParameters;
  setSimulationRate: SetSimulationRateParameters;
  setSimulationStartTime: SetSimulationStartTimeParameters;
  setSimulationStep: SetSimulationStepParameters;
  setStop: SetStopParameters;
  setTerminalStation: SetTerminalStationParameters;
  setWaitForDepartureCommand: SetWaitForDepartureCommandParameters;
  startSimulation: StartSimulationParameters;
  stepSimulation: StepSimulationParameters;
  terminateApplication: TerminateApplicationParameters;
}

export interface ActivateTrainParameters {
  trainID: string;
}

export interface AddTimetableEntryParameters {
  trainID: string;
  stationID: string;
  arrivalTime: number;
  departureTime: number;
  dwellTime: number;
  stopFlag: boolean;
}

export interface AddTrainParameters {
  trainID: string;
  rollingStockID: string;
  trainSpeedType: string;
  itineraryName: string;
  itineraryName2: string;
  itineraryName3: string;
  creationTime: number;
  startTime: number;
  performanceFactorOnTime: number;
  performanceFactorDelayed: number;
  enteringSpeed: number;
  routeReservationType: string;
}

export interface CancelConnectionParameters {
  trainID: string;
  connTrainID: string;
  stationID: string;
}

export interface CancelRouteParameters {
  trainID: string;
  routeID: string;
}

export interface DeactivateTrainParameters {
  trainID: string;
}

export interface EndSimulationParameters {
  time?: number;
}

export interface InfoPanelParameters {}

export interface OpenSimulationPanelParameters {
  mode?: "Simulation" | "Controller" | "Output";
}

export interface PauseSimulationParameters {
  time?: number;
}

export interface RemoveTrainParameters {
  trainID: string;
}

export interface ResetMovementAuthorityParameters {
  trainID: string;
  time?: number;
}

export interface ResetRequestedDecelerationParameters {
  trainID: string;
  time?: number;
}

export interface ResetRequestedSpeedParameters {
  trainID: string;
  time?: number;
}

export interface ResetTimetableParameters {}

export interface SetArrivalTimeParameters {
  trainID: string;
  stationID: string;
  time: number;
}

export interface SetConnectionParameters {
  trainID: string;
  connTrainID: string;
  stationID: string;
  connectionTime: number;
  maxConnectionTime: number;
  joinFlag: boolean;
  splitFlag: boolean;
}

export interface SetDelayScenarioParameters {
  scenarioID: number;
}

export interface SetDepartureCommandParameters {
  trainID: string;
  time?: number;
}

export interface SetDepartureTimeParameters {
  trainID: string;
  stationID: string;
  time: number;
}

export interface SetDwellTimeParameters {
  trainID: string;
  stationID: string;
  time: number;
}

export interface SetEngineSwitchParameters {
  trainID: string;
  switchOnOffFlag: boolean;
  time?: number;
}

export interface SetPassingTimeParameters {
  trainID: string;
  stationID: string;
  time: number;
}

export interface SetPerformanceParameters {
  trainID: string;
  performanceFactorOnTime: number;
  performanceFactorDelayed: number;
  time?: number;
}

export interface SetPositionCoastingParameters {
  trainID: string;
  startRouteID: string;
  startRouteOffset: number;
  endRouteID: string;
  endRouteOffset: number;
}

export interface SetPositionSpeedParameters {
  endRouteID: string;
  endTime: number;
  headOnlyFlag: boolean;
  speed: number;
  startRouteID: string;
  startRouteOffset: number;
  startTime: number;
  trainID?: string;
}

export interface SetPriorityOfStartItineraryParameters {
  trainID: string;
  priority: number;
}

export interface SetRequestedDecelerationParameters {
  trainID: string;
  deceleration: number;
  time?: number;
}

export interface SetRequestedSpeedParameters {
  trainID: string;
  speed: number;
  time?: number;
}

export interface SetRouteAllowedParameters {
  trainID: string;
  routeID: string;
  time?: number;
}

export interface SetRouteDisallowedParameters {
  trainID: string;
  routeID: string;
}

export interface SetRouteReserveParameters {
  trainID: string;
  routeID: string;
  time?: number;
}

export interface SetSendPositionReportsParameters {
  trainID: string;
  flag: boolean;
  time?: number;
}

export interface SetSimulationEndTimeParameters {
  time: number;
}

export interface SetSimulationPauseTimeParameters {
  time: number;
}

export interface SetSimulationRateParameters {
  rate: string;
}

export interface SetSimulationStartTimeParameters {
  time: number;
}

export interface SetSimulationStepParameters {
  time: number;
}

export interface SetStopParameters {
  trainID: string;
  stationID: string;
  stopFlag: boolean;
}

export interface SetTerminalStationParameters {
  trainID: string;
  stationID: string;
}

export interface SetWaitForDepartureCommandParameters {
  trainID: string;
  flag: boolean;
}

export interface StartSimulationParameters {
  time?: number;
}

export interface StepSimulationParameters {}

export interface TerminateApplicationParameters {}

export type SetMovementAuthorityParameters =
  | {
      trainID: string;
      routeID: string;
      routeOffset: number;
      startTime: number;
      endTime: number;
    }
  | {
      trainID: string;
      routeID: string;
      routeOffset: number;
      startTime?: undefined;
      endTime?: undefined;
    };
