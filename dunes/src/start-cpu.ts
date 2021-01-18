import * as tf from "@tensorflow/tfjs-node";
import { run } from "./run";

run(tf).catch((error): void => {
  process.exitCode = 1;
  console.error(error);
});
