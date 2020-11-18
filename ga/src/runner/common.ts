import { FitStats, InputConfig, Statement } from "../index-no-runner";

export interface RunSummarySpecimen<Inputs extends InputConfig> {
  specimen: Statement<Inputs>;
  fit: FitStats;
}
export interface RunSummary<Inputs extends InputConfig> {
  number: number;
  specimens: readonly RunSummarySpecimen<Inputs>[];
}
