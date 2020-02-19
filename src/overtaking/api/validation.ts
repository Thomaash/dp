import { expect } from "chai";

export function validateModule(decisionModule: unknown): void {
  expect(decisionModule, "Each module has to have a name")
    .to.have.ownProperty("name")
    .that.is.a("string")
    .and.does.not.equal("");

  expect(decisionModule)
    .to.have.ownProperty("newTrainEnteredOvertakingArea")
    .that.is.a("function");
}
