import type { LayersModel } from "@tensorflow/tfjs";
import { CreateModel } from "./types";

export const createModelB: CreateModel = function createModelB(
  tf,
  inputShape,
  dropoutRate = 0.05
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

    if ((model.outputShape[1] ?? 0) > 70) {
      model.add(
        tf.layers.conv1d({
          activation: "relu",
          filters: 2 ** 4,
          kernelSize: [9],
          padding: "valid",
          useBias: true,
        })
      );
      dropout();
      model.add(
        tf.layers.conv1d({
          activation: "relu",
          filters: 2 ** 4,
          kernelSize: [9],
          padding: "valid",
          useBias: true,
        })
      );
      dropout();
      model.add(
        tf.layers.maxPool1d({
          poolSize: 2 ** 4,
        })
      );
      dropout();
    }

    while ((model.outputShape[1] ?? 0) > 30) {
      model.add(
        tf.layers.conv1d({
          activation: "relu",
          filters: 2 ** 3,
          kernelSize: [4],
          padding: "valid",
          useBias: true,
        })
      );
      dropout();
      model.add(
        tf.layers.conv1d({
          activation: "relu",
          filters: 2 ** 3,
          kernelSize: [4],
          padding: "valid",
          useBias: true,
        })
      );
      dropout();
      model.add(
        tf.layers.maxPool1d({
          poolSize: 2 ** 3,
        })
      );
      dropout();
    }

    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 2 ** 10,
        kernelSize: [3],
        padding: "valid",
        useBias: true,
      })
    );
    dropout();
    model.add(tf.layers.globalMaxPool1d({}));
    dropout();

    model.add(
      tf.layers.dense({
        activation: "relu",
        units: 2 ** 6,
        useBias: true,
      })
    );
    dropout();
    model.add(
      tf.layers.dense({
        activation: "relu",
        units: 2 ** 10,
        useBias: true,
      })
    );
    dropout();

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
