import { expect } from "chai";

export type Prepare<T> = (() => T) | (() => Promise<T>);

export interface Assertion<T> {
  expect: (ret: T, name?: string) => void;
}

export type Given<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => Assertion<ReturnType<T>>;
export type Use<T extends any[], R> = (
  instruction: (...args: T) => R
) => Assertion<R>;

export function ddIt<T extends (...args: any[]) => any>(
  name: string,
  prepare: Prepare<T>,
  test: (given: Given<T>) => void
): void {
  describe(name, function(): void {
    let fun: (...args: any[]) => any;

    it("Prepare", async (): Promise<void> => {
      fun = await prepare();
    });

    test(
      (...args): Assertion<ReturnType<T>> => ({
        expect: (ret, message): void => {
          const argsName = JSON.stringify(args).slice(1, -1);
          const retName = JSON.stringify(ret);
          it(`(${argsName}) => ${retName}`, function(): void {
            expect(fun(...args)).to.equal(ret, message);
          });
        }
      })
    );
  });
}
