export type InOutPair = [number[], number[]];
export type InOutPair3 = [[number, number, number][], number[]];
export type InOutPairA = [number[][], number[]];

export type LoadDataRet = {
  getBalancedTraining(max?: number): string[];
  training: string[];
  validation: string[];
};
export type LoadData = () => Promise<LoadDataRet>;
