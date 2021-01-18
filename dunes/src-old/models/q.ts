import type { LayersModel } from "@tensorflow/tfjs";
import { CreateModel } from "./types";

export const createModelQ: CreateModel = function createModelQ(
  tf,
  inputShape,
  dropoutRate = 0.05,
  layers = 5,
  noise = 0
): LayersModel {
  const model = tf.sequential();

  try {
    model.add(
      tf.layers.inputLayer({
        inputShape,
      })
    );
    if (noise > 0) {
      model.add(
        tf.layers.gaussianNoise({
          stddev: noise,
        })
      );
    }

    new Array(layers).fill(null).forEach((): void => {
      model.add(tf.layers.batchNormalization());
      model.add(
        tf.layers.conv1d({
          activation: "relu",
          filters: 2 ** 4,
          kernelSize: 19,
          padding: "same",
          useBias: true,
        })
      );
      model.add(
        tf.layers.conv1d({
          activation: "relu",
          filters: 2 ** 4,
          kernelSize: 19,
          padding: "same",
          useBias: true,
        })
      );
      model.add(
        tf.layers.maxPool1d({
          padding: "same",
          poolSize: 3,
        })
      );
    });

    model.add(tf.layers.globalMaxPool1d());
    model.add(
      tf.layers.dense({
        activation: "relu",
        units: 2 ** 6,
        useBias: true,
      })
    );
    model.add(
      tf.layers.dropout({
        rate: dropoutRate,
      })
    );
    model.add(
      tf.layers.dense({
        activation: "relu",
        units: 2 ** 6,
        useBias: true,
      })
    );
    model.add(
      tf.layers.dropout({
        rate: dropoutRate,
      })
    );
    model.add(
      tf.layers.dense({
        activation: "softmax",
        units: 5,
        useBias: true,
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
