import { Config, sendSimpleRequest as send } from "./common";

/// activateTrain {{{

export interface ActivateTrainParameters {
  trainID: string;
}
export function activateTrain(
  this: Config,
  { trainID }: ActivateTrainParameters
): ReturnType<typeof send> {
  return send.call(this, "activateTrain", [
    { name: "trainID", value: trainID }
  ]);
}

/// }}}
/// addTimetableEntry {{{

export interface AddTimetableEntryParameters {
  trainID: string;
  stationID: string;
  arrivalTime: number;
  departureTime: number;
  dwellTime: number;
  stopFlag: boolean;
}
export function addTimetableEntry(
  this: Config,
  {
    trainID,
    stationID,
    arrivalTime,
    departureTime,
    dwellTime,
    stopFlag
  }: AddTimetableEntryParameters
): ReturnType<typeof send> {
  return send.call(this, "addTimetableEntry", [
    { name: "trainID", value: trainID },
    { name: "stationID", value: stationID },
    { name: "arrivalTime", value: arrivalTime },
    { name: "departureTime", value: departureTime },
    { name: "dwellTime", value: dwellTime },
    { name: "stopFlag", value: stopFlag }
  ]);
}

/// }}}
/// addTrain {{{

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
export function addTrain(
  this: Config,
  {
    trainID,
    rollingStockID,
    trainSpeedType,
    itineraryName,
    itineraryName2,
    itineraryName3,
    creationTime,
    startTime,
    performanceFactorOnTime,
    performanceFactorDelayed,
    enteringSpeed,
    routeReservationType
  }: AddTrainParameters
): ReturnType<typeof send> {
  return send.call(this, "addTrain", [
    { name: "trainID", value: trainID },
    { name: "rollingStockID", value: rollingStockID },
    { name: "trainSpeedType", value: trainSpeedType },
    { name: "itineraryName", value: itineraryName },
    { name: "itineraryName2", value: itineraryName2 },
    { name: "itineraryName3", value: itineraryName3 },
    { name: "creationTime", value: creationTime },
    { name: "startTime", value: startTime },
    { name: "performanceFactorOnTime", value: performanceFactorOnTime },
    { name: "performanceFactorDelayed", value: performanceFactorDelayed },
    { name: "enteringSpeed", value: enteringSpeed },
    { name: "routeReservationType", value: routeReservationType }
  ]);
}

/// }}}
/// cancelConnection {{{

export interface CancelConnectionParameters {
  trainID: string;
  connTrainID: string;
  stationID: string;
}
export function cancelConnection(
  this: Config,
  { trainID, connTrainID, stationID }: CancelConnectionParameters
): ReturnType<typeof send> {
  return send.call(this, "cancelConnection", [
    { name: "trainID", value: trainID },
    { name: "connTrainID", value: connTrainID },
    { name: "stationID", value: stationID }
  ]);
}

/// }}}
/// cancelRoute {{{

export interface CancelRouteParameters {
  trainID: string;
  routeID: string;
}
export function cancelRoute(
  this: Config,
  { trainID, routeID }: CancelRouteParameters
): ReturnType<typeof send> {
  return send.call(this, "cancelRoute", [
    { name: "trainID", value: trainID },
    { name: "routeID", value: routeID }
  ]);
}

/// }}}
/// deactivateTrain {{{

export interface DeactivateTrainParameters {
  trainID: string;
}
export function deactivateTrain(
  this: Config,
  { trainID }: DeactivateTrainParameters
): ReturnType<typeof send> {
  return send.call(this, "deactivateTrain", [
    { name: "trainID", value: trainID }
  ]);
}

/// }}}
/// endSimulation {{{

export interface EndSimulationParameters {
  time?: number;
}
export function endSimulation(
  this: Config,
  { time }: EndSimulationParameters = {}
): ReturnType<typeof send> {
  return send.call(this, "endSimulation", [{ name: "time", value: time }]);
}

/// }}}
/// infoPanel {{{

export interface InfoPanelParameters {}
export function infoPanel(this: Config): ReturnType<typeof send> {
  return send.call(this, "infoPanel", []);
}

/// }}}
/// pauseSimulation {{{

export interface PauseSimulationParameters {
  time?: number;
}
export function pauseSimulation(
  this: Config,
  { time }: PauseSimulationParameters = {}
): ReturnType<typeof send> {
  return send.call(this, "pauseSimulation", [{ name: "time", value: time }]);
}

/// }}}
/// removeTrain {{{

export interface RemoveTrainParameters {
  trainID: string;
}
export function removeTrain(
  this: Config,
  { trainID }: RemoveTrainParameters
): ReturnType<typeof send> {
  return send.call(this, "removeTrain", [{ name: "trainID", value: trainID }]);
}

/// }}}
/// resetMovementAuthority {{{

export interface ResetMovementAuthorityParameters {
  trainID: string;
  time?: number;
}
export function resetMovementAuthority(
  this: Config,
  { trainID, time }: ResetMovementAuthorityParameters
): ReturnType<typeof send> {
  return send.call(this, "resetMovementAuthority", [
    { name: "trainID", value: trainID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// resetRequestedDeceleration {{{

export interface ResetRequestedDecelerationParameters {
  trainID: string;
  time?: number;
}
export function resetRequestedDeceleration(
  this: Config,
  { trainID, time }: ResetRequestedDecelerationParameters
): ReturnType<typeof send> {
  return send.call(this, "resetRequestedDeceleration", [
    { name: "trainID", value: trainID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// resetRequestedSpeed {{{

export interface ResetRequestedSpeedParameters {
  trainID: string;
  time?: number;
}
export function resetRequestedSpeed(
  this: Config,
  { trainID, time }: ResetRequestedSpeedParameters
): ReturnType<typeof send> {
  return send.call(this, "resetRequestedSpeed", [
    { name: "trainID", value: trainID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// resetTimetable {{{

export interface ResetTimetableParameters {}
export function resetTimetable(this: Config): ReturnType<typeof send> {
  return send.call(this, "resetTimetable", []);
}

/// }}}
/// setArrivalTime {{{

export interface SetArrivalTimeParameters {
  trainID: string;
  stationID: string;
  time: number;
}
export function setArrivalTime(
  this: Config,
  { trainID, stationID, time }: SetArrivalTimeParameters
): ReturnType<typeof send> {
  return send.call(this, "setArrivalTime", [
    { name: "trainID", value: trainID },
    { name: "stationID", value: stationID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setConnection {{{

export interface SetConnectionParameters {
  trainID: string;
  connTrainID: string;
  stationID: string;
  connectionTime: number;
  maxConnectionTime: number;
  joinFlag: boolean;
  splitFlag: boolean;
}
export function setConnection(
  this: Config,
  {
    trainID,
    connTrainID,
    stationID,
    connectionTime,
    maxConnectionTime,
    joinFlag,
    splitFlag
  }: SetConnectionParameters
): ReturnType<typeof send> {
  return send.call(this, "setConnection", [
    { name: "trainID", value: trainID },
    { name: "connTrainID", value: connTrainID },
    { name: "stationID", value: stationID },
    { name: "connectionTime", value: connectionTime },
    { name: "maxConnectionTime", value: maxConnectionTime },
    { name: "joinFlag", value: joinFlag },
    { name: "splitFlag", value: splitFlag }
  ]);
}

/// }}}
/// setDelayScenario {{{

export interface SetDelayScenarioParameters {
  scenarioID: number;
}
export function setDelayScenario(
  this: Config,
  { scenarioID }: SetDelayScenarioParameters
): ReturnType<typeof send> {
  return send.call(this, "setDelayScenario", [
    { name: "scenarioID", value: scenarioID }
  ]);
}

/// }}}
/// setDepartureCommand {{{

export interface SetDepartureCommandParameters {
  trainID: string;
  time?: number;
}
export function setDepartureCommand(
  this: Config,
  { trainID, time }: SetDepartureCommandParameters
): ReturnType<typeof send> {
  return send.call(this, "setDepartureCommand", [
    { name: "trainID", value: trainID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setDepartureTime {{{

export interface SetDepartureTimeParameters {
  trainID: string;
  stationID: string;
  time: number;
}
export function setDepartureTime(
  this: Config,
  { trainID, stationID, time }: SetDepartureTimeParameters
): ReturnType<typeof send> {
  return send.call(this, "setDepartureTime", [
    { name: "trainID", value: trainID },
    { name: "stationID", value: stationID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setDwellTime {{{

export interface SetDwellTimeParameters {
  trainID: string;
  stationID: string;
  time: number;
}
export function setDwellTime(
  this: Config,
  { trainID, stationID, time }: SetDwellTimeParameters
): ReturnType<typeof send> {
  return send.call(this, "setDwellTime", [
    { name: "trainID", value: trainID },
    { name: "stationID", value: stationID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setEngineSwitch {{{

export interface SetEngineSwitchParameters {
  trainID: string;
  switchOnOffFlag: boolean;
  time?: number;
}
export function setEngineSwitch(
  this: Config,
  { trainID, switchOnOffFlag, time }: SetEngineSwitchParameters
): ReturnType<typeof send> {
  return send.call(this, "setEngineSwitch", [
    { name: "trainID", value: trainID },
    { name: "switchOnOffFlag", value: switchOnOffFlag },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setMovementAuthority {{{

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
export function setMovementAuthority(
  this: Config,
  {
    trainID,
    routeID,
    routeOffset,
    startTime,
    endTime
  }: SetMovementAuthorityParameters
): ReturnType<typeof send> {
  return send.call(this, "setMovementAuthority", [
    { name: "trainID", value: trainID },
    { name: "routeID", value: routeID },
    { name: "routeOffset", value: routeOffset },
    { name: "startTime", value: startTime },
    { name: "endTime", value: endTime }
  ]);
}

/// }}}
/// setPassingTime {{{

export interface SetPassingTimeParameters {
  trainID: string;
  stationID: string;
  time: number;
}
export function setPassingTime(
  this: Config,
  { trainID, stationID, time }: SetPassingTimeParameters
): ReturnType<typeof send> {
  return send.call(this, "setPassingTime", [
    { name: "trainID", value: trainID },
    { name: "stationID", value: stationID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setPerformance {{{

export interface SetPerformanceParameters {
  trainID: string;
  performanceFactorOnTime: number;
  performanceFactorDelayed: number;
  time?: number;
}
export function setPerformance(
  this: Config,
  {
    trainID,
    performanceFactorOnTime,
    performanceFactorDelayed,
    time
  }: SetPerformanceParameters
): ReturnType<typeof send> {
  return send.call(this, "setPerformance", [
    { name: "trainID", value: trainID },
    { name: "performanceFactorOnTime", value: performanceFactorOnTime },
    { name: "performanceFactorDelayed", value: performanceFactorDelayed },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setPositionCoasting {{{

export interface SetPositionCoastingParameters {
  trainID: string;
  startRouteID: string;
  startRouteOffset: number;
  endRouteID: string;
  endRouteOffset: number;
}
export function setPositionCoasting(
  this: Config,
  {
    trainID,
    startRouteID,
    startRouteOffset,
    endRouteID,
    endRouteOffset
  }: SetPositionCoastingParameters
): ReturnType<typeof send> {
  return send.call(this, "setPositionCoasting", [
    { name: "trainID", value: trainID },
    { name: "startRouteID", value: startRouteID },
    { name: "startRouteOffset", value: startRouteOffset },
    { name: "endRouteID", value: endRouteID },
    { name: "endRouteOffset", value: endRouteOffset }
  ]);
}

/// }}}
/// setPositionSpeed {{{

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
export function setPositionSpeed(
  this: Config,
  {
    endRouteID,
    endTime,
    headOnlyFlag,
    speed,
    startRouteID,
    startRouteOffset,
    startTime,
    trainID
  }: SetPositionSpeedParameters
): ReturnType<typeof send> {
  return send.call(this, "setPositionSpeed", [
    { name: "endRouteID", value: endRouteID },
    { name: "endTime", value: endTime },
    { name: "headOnlyFlag", value: headOnlyFlag },
    { name: "speed", value: speed },
    { name: "startRouteID", value: startRouteID },
    { name: "startRouteOffset", value: startRouteOffset },
    { name: "startTime", value: startTime },
    { name: "trainID", value: trainID }
  ]);
}

/// }}}
/// setPriorityOfStartItinerary {{{

export interface SetPriorityOfStartItineraryParameters {
  trainID: string;
  priority: number;
}
export function setPriorityOfStartItinerary(
  this: Config,
  { trainID, priority }: SetPriorityOfStartItineraryParameters
): ReturnType<typeof send> {
  return send.call(this, "setPriorityOfStartItinerary", [
    { name: "trainID", value: trainID },
    { name: "priority", value: priority }
  ]);
}

/// }}}
/// setRequestedDeceleration {{{

export interface SetRequestedDecelerationParameters {
  trainID: string;
  deceleration: number;
  time?: number;
}
export function setRequestedDeceleration(
  this: Config,
  { trainID, deceleration, time }: SetRequestedDecelerationParameters
): ReturnType<typeof send> {
  return send.call(this, "setRequestedDeceleration", [
    { name: "trainID", value: trainID },
    { name: "deceleration", value: deceleration },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setRequestedSpeed {{{

export interface SetRequestedSpeedParameters {
  trainID: string;
  speed: number;
  time?: number;
}
export function setRequestedSpeed(
  this: Config,
  { trainID, speed, time }: SetRequestedSpeedParameters
): ReturnType<typeof send> {
  return send.call(this, "setRequestedSpeed", [
    { name: "trainID", value: trainID },
    { name: "speed", value: speed },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setRouteAllowed {{{

export interface SetRouteAllowedParameters {
  trainID: string;
  routeID: string;
  time?: number;
}
export function setRouteAllowed(
  this: Config,
  { trainID, routeID, time }: SetRouteAllowedParameters
): ReturnType<typeof send> {
  return send.call(this, "setRouteAllowed", [
    { name: "trainID", value: trainID },
    { name: "routeID", value: routeID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setRouteDisallowed {{{

export interface SetRouteDisallowedParameters {
  trainID: string;
  routeID: string;
}
export function setRouteDisallowed(
  this: Config,
  { trainID, routeID }: SetRouteDisallowedParameters
): ReturnType<typeof send> {
  return send.call(this, "setRouteDisallowed", [
    { name: "trainID", value: trainID },
    { name: "routeID", value: routeID }
  ]);
}

/// }}}
/// setRouteReserve {{{

export interface SetRouteReserveParameters {
  trainID: string;
  routeID: string;
  time?: number;
}
export function setRouteReserve(
  this: Config,
  { trainID, routeID, time }: SetRouteReserveParameters
): ReturnType<typeof send> {
  return send.call(this, "setRouteReserve", [
    { name: "trainID", value: trainID },
    { name: "routeID", value: routeID },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setSendPositionReports {{{

export interface SetSendPositionReportsParameters {
  trainID: string;
  flag: boolean;
  time?: number;
}
export function setSendPositionReports(
  this: Config,
  { trainID, flag, time }: SetSendPositionReportsParameters
): ReturnType<typeof send> {
  return send.call(this, "setSendPositionReports", [
    { name: "trainID", value: trainID },
    { name: "flag", value: flag },
    { name: "time", value: time }
  ]);
}

/// }}}
/// setSimulationEndTime {{{

export interface SetSimulationEndTimeParameters {
  time: number;
}
export function setSimulationEndTime(
  this: Config,
  { time }: SetSimulationEndTimeParameters
): ReturnType<typeof send> {
  return send.call(this, "setSimulationEndTime", [
    { name: "time", value: time }
  ]);
}

/// }}}
/// setSimulationPauseTime {{{

export interface SetSimulationPauseTimeParameters {
  time: number;
}
export function setSimulationPauseTime(
  this: Config,
  { time }: SetSimulationPauseTimeParameters
): ReturnType<typeof send> {
  return send.call(this, "setSimulationPauseTime", [
    { name: "time", value: time }
  ]);
}

/// }}}
/// setSimulationRate {{{

export interface SetSimulationRateParameters {
  rate: string;
}
export function setSimulationRate(
  this: Config,
  { rate }: SetSimulationRateParameters
): ReturnType<typeof send> {
  return send.call(this, "setSimulationRate", [{ name: "rate", value: rate }]);
}

/// }}}
/// setSimulationStartTime {{{

export interface SetSimulationStartTimeParameters {
  time: number;
}
export function setSimulationStartTime(
  this: Config,
  { time }: SetSimulationStartTimeParameters
): ReturnType<typeof send> {
  return send.call(this, "setSimulationStartTime", [
    { name: "time", value: time }
  ]);
}

/// }}}
/// setSimulationStep {{{

export interface SetSimulationStepParameters {
  time: number;
}
export function setSimulationStep(
  this: Config,
  { time }: SetSimulationStepParameters
): ReturnType<typeof send> {
  return send.call(this, "setSimulationStep", [{ name: "time", value: time }]);
}

/// }}}
/// setStop {{{

export interface SetStopParameters {
  trainID: string;
  stationID: string;
  stopFlag: boolean;
}
export function setStop(
  this: Config,
  { trainID, stationID, stopFlag }: SetStopParameters
): ReturnType<typeof send> {
  return send.call(this, "setStop", [
    { name: "trainID", value: trainID },
    { name: "stationID", value: stationID },
    { name: "stopFlag", value: stopFlag }
  ]);
}

/// }}}
/// setTerminalStation {{{

export interface SetTerminalStationParameters {
  trainID: string;
  stationID: string;
}
export function setTerminalStation(
  this: Config,
  { trainID, stationID }: SetTerminalStationParameters
): ReturnType<typeof send> {
  return send.call(this, "setTerminalStation", [
    { name: "trainID", value: trainID },
    { name: "stationID", value: stationID }
  ]);
}

/// }}}
/// setWaitForDepartureCommand {{{

export interface SetWaitForDepartureCommandParameters {
  trainID: string;
  flag: boolean;
}
export function setWaitForDepartureCommand(
  this: Config,
  { trainID, flag }: SetWaitForDepartureCommandParameters
): ReturnType<typeof send> {
  return send.call(this, "setWaitForDepartureCommand", [
    { name: "trainID", value: trainID },
    { name: "flag", value: flag }
  ]);
}

/// }}}
/// startSimulation {{{

export interface StartSimulationParameters {
  time?: number;
}
export function startSimulation(
  this: Config,
  { time }: StartSimulationParameters = {}
): ReturnType<typeof send> {
  return send.call(this, "startSimulation", [{ name: "time", value: time }]);
}

/// }}}
/// stepSimulation {{{

export interface StepSimulationParameters {}
export function stepSimulation(this: Config): ReturnType<typeof send> {
  return send.call(this, "stepSimulation", []);
}

/// }}}
/// terminateApplication {{{

export interface TerminateApplicationParameters {}
export function terminateApplication(this: Config): ReturnType<typeof send> {
  return send.call(this, "terminateApplication", []);
}

/// }}}

// vim:fdm=marker
