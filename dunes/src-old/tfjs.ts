import type * as TFJSNode from "@tensorflow/tfjs-node";
import type * as TFJSNodeGPU from "@tensorflow/tfjs-node-gpu";

export type TFJS = typeof TFJSNode | typeof TFJSNodeGPU;
