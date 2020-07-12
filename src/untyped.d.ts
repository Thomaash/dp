declare module "jstat" {
  /**
   * Returns an array of partial sums in the sequence.
   */
  export function cumsum(values: readonly number[]): number[];

  /**
   * Cumulatively reduces values using a function and return a new object.
   */
  export function cumreduce(
    values: readonly number[],
    fn: (a: number, b: number) => number
  ): number;

  /**
   * Returns the mean of the array vector.
   */
  export function mean(values: readonly number[]): number;

  /**
   * Returns a 1-alpha confidence interval for value given a normal distribution
   * with a standard deviation sd and a sample size n.
   */
  export function normalci(
    value: number,
    alpha: number,
    sd: number,
    n: number
  ): [number, number];

  /**
   * Returns a 1-alpha confidence interval for value given a normal distribution
   * in the data from array.
   */
  export function normalci(
    value: number,
    alpha: number,
    array: readonly number[]
  ): [number, number];
}
