import { DecisionModuleFactory } from "../api-public";

import { decisionModuleFactory as doNothingDMF } from "./do-nothing";
import { decisionModuleFactory as maxSpeedDMF } from "./max-speed";
import { decisionModuleFactory as timetableGuessDMF } from "./timetable-guess";

export { doNothingDMF, maxSpeedDMF, timetableGuessDMF };

export const decisionModuleFactories: Record<string, DecisionModuleFactory> = {
  [doNothingDMF.name]: doNothingDMF,
  [maxSpeedDMF.name]: maxSpeedDMF,
  [timetableGuessDMF.name]: timetableGuessDMF,
};
