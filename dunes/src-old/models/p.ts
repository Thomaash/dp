import type { LayersModel } from "@tensorflow/tfjs";
import { CreateModel } from "./types";

export const createModelP: CreateModel = function createModelP(
  tf,
  inputShape,
  dropoutRate = 0.05,
  layers = 5
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

    new Array(layers).fill(null).forEach((): void => {
      model.add(
        tf.layers.conv1d({
          activation: undefined,
          filters: 2 ** 4,
          kernelSize: 19,
          padding: "same",
          useBias: true,
        })
      );
      model.add(tf.layers.leakyReLU({ alpha: 0.1 }));
      dropout();
      model.add(
        tf.layers.conv1d({
          activation: undefined,
          filters: 2 ** 4,
          kernelSize: 19,
          padding: "same",
          useBias: true,
        })
      );
      model.add(tf.layers.leakyReLU({ alpha: 0.1 }));
      dropout();
      model.add(
        tf.layers.maxPool1d({
          padding: "same",
          poolSize: 3,
        })
      );
      dropout();
    });

    model.add(tf.layers.globalMaxPool1d());
    model.add(
      tf.layers.dense({
        activation: undefined,
        units: 2 ** 6,
        useBias: true,
      })
    );
    model.add(tf.layers.leakyReLU({ alpha: 0.1 }));
    dropout();
    model.add(
      tf.layers.dense({
        activation: undefined,
        units: 2 ** 6,
        useBias: true,
      })
    );
    model.add(tf.layers.leakyReLU({ alpha: 0.1 }));
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
