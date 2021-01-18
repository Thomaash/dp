import type { LayersModel, Shape } from "@tensorflow/tfjs";
import { TFJS } from "./tfjs";

export function createModel(tf: TFJS, inputShape: Shape): LayersModel {
  const model = tf.sequential();

  try {
    model.add(
      tf.layers.inputLayer({
        inputShape,
      })
    );

    new Array(5).fill(null).forEach((): void => {
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

    new Array(2).fill(null).forEach((): void => {
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
          rate: 0.5,
        })
      );
    });

    model.add(
      tf.layers.dense({
        activation: "softmax",
        units: 5,
        useBias: true,
      })
    );

    const learningRate = 0.001;
    const beta1 = 0.9;
    const beta2 = 0.999;
    const epsilon = 1e-7;
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
}
