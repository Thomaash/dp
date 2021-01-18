import CCWT from "ccwt.js";
import type * as tf from "@tensorflow/tfjs";
import { TensorDataJSON2D, normalize2D } from "../utils";
import { readFile, writeFile } from "fs-extra";
import { transpose } from "ramda";

(async (): Promise<void> => {
  let valid = true;

  const ccwt = await CCWT;

  const pcmPath = process.argv[2];
  const fftPath = process.argv[3];
  const label = process.argv[4];
  const labels = process.argv[5].split(".");
  const height = +process.argv[6];
  const accumulatedSamples = +process.argv[7];

  const pcmBuffer = await readFile(pcmPath);

  const pcm = new Float32Array(pcmBuffer.length / 2);
  for (let offset = 0; offset < pcmBuffer.length; offset += 2) {
    pcm[offset / 2] = pcmBuffer.readInt16LE(offset);
    if (!Number.isFinite(pcm[offset / 2])) {
      valid = false;
    }
  }

  if (!valid) {
    process.exitCode = 1;
    return;
  }

  const deviation = 1;

  const frequencyBasis = 0;

  const frequencyOffset = 0;
  const frequencyRange = 2000 - frequencyOffset;

  const frequencies = ccwt.frequencyBand(
    height,
    frequencyRange,
    frequencyOffset,
    frequencyBasis,
    deviation
  );

  const fftPadding = 0;
  const gain = 1;

  const fourierTransformedSignal = ccwt.fft1d(pcm, fftPadding, gain);

  const numbericOutputPadding = 0;
  const outputWidth = pcm.length / accumulatedSamples;

  const fft = await new Promise<number[][]>((resolve): void => {
    let doneRows = 0;
    const data = Array<number[]>(height);

    ccwt.numericOutput(
      fourierTransformedSignal,
      numbericOutputPadding,
      frequencies,
      0,
      height,
      outputWidth,
      (y, rowData, outputPadding): void => {
        const rowAmplitudes = Array(rowData.length / 2 - outputPadding * 2)
          .fill(null)
          .map((_, x): number => {
            const r = rowData[outputPadding * 2 + x * 2];
            const i = rowData[outputPadding * 2 + x * 2 + 1];

            return Math.hypot(r, i);
          });

        rowAmplitudes.forEach((value): void => {
          if (!Number.isFinite(value)) {
            valid = false;
          }
        });

        data[y] = rowAmplitudes;

        ++doneRows;
        if (doneRows === height) {
          resolve(transpose(data));
        }
      }
    );
  });

  if (!valid) {
    process.exitCode = 1;
    return;
  }

  const shape: [number, number] = [fft.length, fft[0].length];
  const dType: tf.DataType = "float32";

  const y = labels.map((l): 0 | 1 => (l === label ? 1 : 0));

  const jsonData: TensorDataJSON2D = {
    dType,
    labels,
    shape,
    x: Array.from(fft),
    y,
  };
  await writeFile(fftPath, JSON.stringify(jsonData, undefined, 4));

  const jsonNormalizedData: TensorDataJSON2D = {
    dType,
    labels,
    shape,
    x: normalize2D(Array.from(fft)),
    y,
  };
  await writeFile(
    [
      ...fftPath.split(".").slice(0, -1),
      "normalized",
      ...fftPath.split(".").slice(-1),
    ].join("."),
    JSON.stringify(jsonNormalizedData, undefined, 4)
  );
})().catch((error): void => {
  console.error(error);
  process.exitCode = 1;
});
