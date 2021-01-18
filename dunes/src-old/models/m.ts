import type { LayersModel } from "@tensorflow/tfjs";
import { CreateModel } from "./types";

export const createModelM: CreateModel = function createModelM(
  tf,
  inputShape,
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
    model.add(tf.layers.batchNormalization());

    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 16,
        kernelSize: 7,
        padding: "same",
        useBias: true,
      })
    );
    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 16,
        kernelSize: 7,
        padding: "same",
        useBias: true,
      })
    );
    model.add(
      tf.layers.maxPool1d({
        padding: "same",
        poolSize: 9,
      })
    );
    model.add(
      tf.layers.dropout({
        rate: 0.05,
      })
    );

    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 32,
        kernelSize: 3,
        padding: "same",
        useBias: true,
      })
    );
    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 32,
        kernelSize: 3,
        padding: "same",
        useBias: true,
      })
    );
    model.add(
      tf.layers.maxPool1d({
        padding: "same",
        poolSize: 9,
      })
    );
    model.add(
      tf.layers.dropout({
        rate: 0.05,
      })
    );

    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 128,
        kernelSize: 3,
        padding: "same",
        useBias: true,
      })
    );
    model.add(
      tf.layers.conv1d({
        activation: "relu",
        filters: 128,
        kernelSize: 3,
        padding: "same",
        useBias: true,
      })
    );
    model.add(tf.layers.globalMaxPool1d());

    model.add(
      tf.layers.dense({
        activation: "relu",
        units: 64,
        useBias: true,
      })
    );
    model.add(
      tf.layers.dropout({
        rate: 0.1,
      })
    );
    model.add(
      tf.layers.dense({
        activation: "relu",
        units: 64,
        useBias: true,
      })
    );
    model.add(
      tf.layers.dropout({
        rate: 0.1,
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
      loss: tf.losses.softmaxCrossEntropy,
      metrics: [tf.metrics.categoricalAccuracy],
      optimizer: new tf.AdamOptimizer(learningRate, beta1, beta2, epsilon),
    });

    return model;
  } catch (error) {
    model.summary();
    throw error;
  }
};
