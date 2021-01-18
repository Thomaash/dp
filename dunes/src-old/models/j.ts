import type { LayersModel } from "@tensorflow/tfjs";
import { CreateModel } from "./types";

export const createModelJ: CreateModel = function createModelJ(
  tf,
  inputShape,
  dropoutRate = 0.05,
  filters = 2 ** 4,
  kernelSize = 19,
  denseLayers = 1,
  denseSize = 2 ** 6,
  bias = 1
): LayersModel {
  const model = tf.sequential();
  function dropout(): void {
    if (dropoutRate > 0) {
      model.add(
        tf.layers.dropout({
          rate: dropoutRate,
        })
      );
    }
  }

  try {
    model.add(
      tf.layers.dropout({
        inputShape,
        rate: dropoutRate,
      })
    );

    new Array(5).fill(null).forEach((): void => {
      model.add(
        tf.layers.conv1d({
          activation: "relu",
          filters,
          kernelSize,
          padding: "same",
          useBias: !!bias,
        })
      );
      dropout();
      model.add(
        tf.layers.maxPool1d({
          padding: "same",
          poolSize: 3,
        })
      );
      dropout();
    });

    model.add(tf.layers.globalMaxPool1d({}));
    new Array(denseLayers).fill(null).forEach((): void => {
      model.add(
        tf.layers.dense({
          activation: "relu",
          units: denseSize,
          useBias: !!bias,
        })
      );
      dropout();
    });

    model.add(
      tf.layers.dense({
        activation: "softmax",
        units: 5,
        useBias: !!bias,
      })
    );

    // Prepare the model for training: Specify the loss and the optimizer.
    model.compile({
      loss: "categoricalCrossentropy",
      metrics: ["categoricalAccuracy"],
      optimizer: "adam",
    });

    return model;
  } catch (error) {
    model.summary();
    throw error;
  }
};
