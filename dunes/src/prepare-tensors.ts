import type {
  ClassWeight,
  DataType,
  Tensor2D,
  Tensor3D,
} from "@tensorflow/tfjs-node";
import { Semaphore } from "async-await-semaphore";
import { TensorDataJSON2D, shuffle } from "./utils";
import { readFile } from "fs-extra";
import { TFJS } from "./tfjs";

const jsonLoadSemaphore = new Semaphore(20);

export interface PreparedTensors {
  classWeights: ClassWeight;
  xs: {
    data: Tensor3D;
    shape: [number, number];
  };
  ys: {
    data: Tensor2D;
    getLabel(y: readonly number[]): string;
    labels: string[];
    shape: [number];
  };
}

function yToLabel(labels: readonly string[], y: readonly number[]): string {
  return y.reduce<[number, string]>(
    ([lastValue, label], value, index): [number, string] =>
      value > lastValue ? [value, labels[index]] : [lastValue, label],
    [Number.NEGATIVE_INFINITY, labels[0]]
  )[1];
}

export async function prepareTensors(
  tf: TFJS,
  paths: readonly string[]
): Promise<PreparedTensors> {
  const { dType, xsShape } = await (async (): Promise<{
    dType: DataType;
    xsShape: [number, number];
  }> => {
    let xsShape: [number, number] | null = null;
    let dType: DataType | null = null;

    const [path] = paths;

    const tensorData: TensorDataJSON2D = JSON.parse(
      await readFile(path, "utf-8")
    );

    if (xsShape == null) {
      xsShape = tensorData.shape;
    }
    if (dType == null) {
      dType = tensorData.dType;
    }

    if (xsShape == null || dType == null) {
      throw new Error("No sample shape or type.");
    }

    return {
      dType,
      xsShape,
    };
  })();

  const sampleXsSize = xsShape.reduce<number>(
    (acc, val): number => acc * val,
    1
  );
  const xsArray = new Float32Array(sampleXsSize * paths.length);

  const { labels, sampleLabels } = await (async (): Promise<{
    sampleLabels: number[][];
    labels: string[];
  }> => {
    let labels: string[] = [];

    const sampleLabels = await Promise.all(
      shuffle(paths).map(
        async (path, i): Promise<number[]> => {
          await jsonLoadSemaphore.p();
          try {
            const tensorData: TensorDataJSON2D = JSON.parse(
              await readFile(path, "utf-8")
            );

            const t = tf.tensor2d(tensorData.x, xsShape, dType);
            xsArray.set(await t.data(), i * sampleXsSize);
            t.dispose();

            labels = tensorData.labels;

            return tensorData.y;
          } finally {
            jsonLoadSemaphore.v();
          }
        }
      )
    );

    if (xsShape == null || dType == null || sampleLabels.length === 0) {
      throw new Error("No samples.");
    }

    return { labels, sampleLabels };
  })();

  const xData: Tensor3D = tf.tensor3d(
    xsArray,
    [sampleLabels.length, xsShape[0], xsShape[1]],
    dType
  );

  const yData: Tensor2D = tf.tensor2d(
    sampleLabels,
    [sampleLabels.length, sampleLabels[0].length],
    "int32"
  );

  const classLengths = sampleLabels.reduce<ClassWeight>(
    (acc, y): ClassWeight => {
      y.forEach((v, i): void => {
        acc[i] = (acc[i] ?? 0) + v;
      });

      return acc;
    },
    Object.create(null)
  );

  const classWeights = Object.entries(classLengths).reduce<ClassWeight>(
    (acc, [i, v]): ClassWeight => {
      acc[+i] = ((sampleLabels.length - v) / sampleLabels.length) ** 2;

      return acc;
    },
    Object.create(null)
  );

  return {
    classWeights,
    xs: {
      data: xData,
      shape: xsShape,
    },
    ys: {
      data: yData,
      getLabel: yToLabel.bind(null, labels),
      labels,
      shape: [labels.length],
    },
  };
}
