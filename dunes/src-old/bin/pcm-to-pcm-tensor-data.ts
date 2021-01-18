import type * as tf from "@tensorflow/tfjs";
import { readFile, writeFile } from "fs-extra";
import { TensorDataJSON2D, normalize1D } from "../utils";

(async (): Promise<void> => {
  const pcmPath = process.argv[2];
  const jsonPath = process.argv[3];
  const label = process.argv[4];
  const labels = process.argv[5].split(".");

  const pcmBuffer = await readFile(pcmPath);

  const pcm = new Float32Array(pcmBuffer.length / 2);
  for (let i = 0; i < pcmBuffer.length / 2; ++i) {
    pcm[i] = pcmBuffer.readInt16LE(i * 2);
    if (!Number.isFinite(pcm[i])) {
      process.exitCode = 1;
      await writeFile(jsonPath + ".failed", i);
      return;
    }
  }

  const shape: [number, 1] = [pcm.length, 1];
  const dType: tf.DataType = "float32";

  const y = labels.map((l): 0 | 1 => (l === label ? 1 : 0));

  const jsonData: TensorDataJSON2D = {
    dType,
    labels,
    shape,
    x: Array.from(pcm).map((v): [number] => [v]),
    y,
  };
  await writeFile(jsonPath, JSON.stringify(jsonData, undefined, 4));

  const jsonNormalizedData: TensorDataJSON2D = {
    dType,
    labels,
    shape,
    x: normalize1D(Array.from(pcm)).map((v): [number] => [v]),
    y,
  };
  if (
    jsonNormalizedData.x.every((vs): boolean =>
      vs.every((v): boolean => Number.isFinite(v))
    )
  ) {
    await writeFile(
      [
        ...jsonPath.split(".").slice(0, -1),
        "normalized",
        ...jsonPath.split(".").slice(-1),
      ].join("."),
      JSON.stringify(jsonNormalizedData)
    );
  } else {
    await writeFile(
      [
        ...jsonPath.split(".").slice(0, -1),
        "normalized",
        ...jsonPath.split(".").slice(-1),
        "failed",
      ].join("."),
      JSON.stringify(jsonNormalizedData, undefined, 4)
    );
    process.exitCode = 1;
  }
})().catch((error): void => {
  console.error(error);
  process.exitCode = 1;
});
