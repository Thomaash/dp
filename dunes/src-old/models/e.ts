import type { LayersModel } from "@tensorflow/tfjs";
import { CreateModel } from "./types";

export const createModelE: CreateModel = function createModelE(
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

    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 2 ** 2,
        kernelSize: 19,
        padding: "same",
        useBias: true,
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

    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 2 ** 3,
        kernelSize: 15,
        padding: "same",
        useBias: true,
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

    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 2 ** 4,
        kernelSize: 11,
        padding: "same",
        useBias: true,
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

    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 2 ** 5,
        kernelSize: 7,
        padding: "same",
        useBias: true,
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

    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 2 ** 6,
        kernelSize: 3,
        padding: "same",
        useBias: true,
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

    model.add(tf.layers.globalMaxPool1d({}));
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
