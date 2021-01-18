import type { LayersModel } from "@tensorflow/tfjs";
import { CreateModel } from "./types";

export const createModelL: CreateModel = function createModelL(
  tf,
  inputShape,
  dropoutRate = 0.05,
  firstKernelSize = 19,
  firstFilters = 2 ** 4,
  lastFilters = 2 ** 4,
  denseLayers = 1,
  denseSize = 2 ** 6,
  bias = 1,
  learningRate = 0.001,
  beta1 = 0.9,
  beta2 = 0.999,
  epsilon = 1e-7
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

    new Array(50).fill(null).forEach((_, i, { length }): void => {
      const kernelSize = firstKernelSize - i * 2;
      if (kernelSize < 3) {
        return;
      }

      const filters =
        i + 1 === length || kernelSize == 3 ? lastFilters : firstFilters;

      console.log({ filters, kernelSize });

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
      loss: tf.losses.softmaxCrossEntropy,
      metrics: [
        // tf.metrics.binaryAccuracy,
        // tf.metrics.binaryCrossentropy,
        // tf.metrics.cosineProximity,
        // tf.metrics.meanAbsoluteError,
        // tf.metrics.meanAbsolutePercentageError,
        // tf.metrics.meanSquaredError,
        // tf.metrics.precision,
        // tf.metrics.recall,
        tf.metrics.categoricalAccuracy,
      ],
      optimizer: new tf.AdamOptimizer(learningRate, beta1, beta2, epsilon),
    });

    return model;
  } catch (error) {
    model.summary();
    throw error;
  }
};
