import type { LayersModel } from "@tensorflow/tfjs";
import { CreateModel } from "./types";

export const createModelR: CreateModel = function createModelR(
  tf,
  inputShape,
  dropoutRate = 0.05,
  layers = 5,
  noise = 0,
  learningRate = 0.001,
  beta1 = 0.9,
  beta2 = 0.999,
  epsilon = 1e-7
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
          activation: undefined,
          filters: 16,
          kernelSize: 19,
          padding: "same",
          useBias: true,
        })
      );
      model.add(tf.layers.leakyReLU({ alpha: 0.1 }));

      model.add(
        tf.layers.conv1d({
          activation: undefined,
          filters: 16,
          kernelSize: 19,
          padding: "same",
          useBias: true,
        })
      );
      model.add(tf.layers.leakyReLU({ alpha: 0.1 }));

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
        activation: undefined,
        units: 64,
        useBias: true,
      })
    );
    model.add(tf.layers.leakyReLU({ alpha: 0.1 }));
    model.add(
      tf.layers.dropout({
        rate: dropoutRate,
      })
    );

    model.add(
      tf.layers.dense({
        activation: undefined,
        units: 64,
        useBias: true,
      })
    );
    model.add(tf.layers.leakyReLU({ alpha: 0.1 }));
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
      optimizer: new tf.AdamOptimizer(learningRate, beta1, beta2, epsilon),
    });

    return model;
  } catch (error) {
    model.summary();
    throw error;
  }
};
