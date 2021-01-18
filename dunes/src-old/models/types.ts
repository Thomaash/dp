import { LayersModel, Shape } from "@tensorflow/tfjs";
import { TFJS } from "../tfjs";

export type CreateModel = (
  tensorFlow: TFJS,
  inputShape: Shape,
  ...rest: readonly number[]
) => LayersModel;

export {};
