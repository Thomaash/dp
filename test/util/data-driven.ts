import { expect } from "chai";

export interface GivenRet<T extends (...args: any[]) => any> {
  expect: (ret: ReturnType<T>, name?: string) => void;
}
export type Given<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => GivenRet<T>;

export function ddIt<T extends (...args: any[]) => any>(
  name: string,
  prepare: (() => T) | (() => Promise<T>),
  test: (given: Given<T>) => void
): void {
  describe(name, function(): void {
    let fun: (...args: any[]) => any;

    it("Prepare", async (): Promise<void> => {
      fun = await prepare();
    });

    test(
      (...args): GivenRet<T> => ({
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
