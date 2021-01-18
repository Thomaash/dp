import type {
  CustomCallbackArgs,
  LayersModel,
  Tensor2D,
} from "@tensorflow/tfjs-node";
import { createModel } from "./model";
import { PreparedTensors, prepareTensors } from "./prepare-tensors";
import { TFJS } from "./tfjs";
import { mkdir, mkdirp, writeFile } from "fs-extra";
import { join } from "path";
import { loadSamplePaths } from "./load-sample-paths";

interface Summary {
  epoch: number;
  loss: number;
  lossValLoss: [number, number];
  valLoss: number;

  labels: string[];
  fit: {
    all: FitResult<number[]>;
    total: FitResult<number>;
    perLabel: Record<string, FitResult<number>>;
  };
  logs: {
    combined: number[];
    individual: unknown;
  };
}
interface FitResult<T> {
  correct: T;
  correctRatio: T;
  total: T;
  wrong: T;
  wrongRatio: T;
}
interface LabelPredictionPair {
  actual: string;
  correct: boolean;
  expected: string;
}

interface LogPaths {
  readonly best: string;
  readonly error: string;
  readonly modelSummary: string;
  readonly models: string;
  readonly predictions: string;
  readonly root: string;
  readonly summary: string;
  readonly tensorBoard: string;
}

function sumPairs(
  labelPairs: readonly LabelPredictionPair[]
): FitResult<number> {
  const correct = labelPairs.filter(({ correct }): boolean => correct === true)
    .length;
  const wrong = labelPairs.filter(({ correct }): boolean => correct !== true)
    .length;
  const total = labelPairs.length;

  return {
    correct,
    correctRatio: correct / total,
    total,
    wrong,
    wrongRatio: wrong / total,
  };
}

function createFitCallback(
  logPaths: LogPaths,
  model: LayersModel,
  validation: PreparedTensors,
  maxEpochsWithoutImprovement: number
): CustomCallbackArgs {
  let bestSummary: Summary | null = null;
  return Object.freeze<CustomCallbackArgs>({
    async onEpochEnd(epoch, logs): Promise<void> {
      const actualYs = await (model.predict(
        validation.xs.data
      ) as Tensor2D).array();
      const expectedYs = await validation.ys.data.array();

      const pairs = expectedYs.map(
        (expectedY, i): LabelPredictionPair => {
          const expected = validation.ys.getLabel(expectedY);
          const actualY = actualYs[i];
          const actual = validation.ys.getLabel(actualY);

          const correct = expected === actual;

          return {
            actual,
            correct,
            expected,
          };
        }
      );

      const fitPerLabel: Summary["fit"]["perLabel"] = validation.ys.labels.reduce<
        Summary["fit"]["perLabel"]
      >((acc, label): Summary["fit"]["perLabel"] => {
        acc[label] = sumPairs(
          pairs.filter((v): boolean => v.expected === label)
        );
        return acc;
      }, {});
      const fitTotal: Summary["fit"]["total"] = sumPairs(pairs);
      const fitAll: Summary["fit"]["all"] = {
        correct: validation.ys.labels.map(
          (label): number => fitPerLabel[label]["correct"]
        ),
        correctRatio: validation.ys.labels.map(
          (label): number => fitPerLabel[label]["correctRatio"]
        ),
        total: validation.ys.labels.map(
          (label): number => fitPerLabel[label]["total"]
        ),
        wrong: validation.ys.labels.map(
          (label): number => fitPerLabel[label]["wrong"]
        ),
        wrongRatio: validation.ys.labels.map(
          (label): number => fitPerLabel[label]["wrongRatio"]
        ),
      };

      console.info(fitTotal.correctRatio, fitAll.correctRatio);

      const loss = logs?.loss ?? Number.NaN;
      const valLoss = logs?.val_loss ?? Number.NaN;

      const summary: Summary = {
        epoch,
        loss,
        lossValLoss: [loss, valLoss],
        valLoss,

        labels: validation.ys.labels,
        fit: {
          all: fitAll,
          perLabel: fitPerLabel,
          total: fitTotal,
        },
        logs: {
          individual: logs,
          combined: Object.values(logs ?? {}).map((v): number => +v),
        },
      };

      if (bestSummary == null || bestSummary.valLoss > summary.valLoss) {
        bestSummary = summary;
      }

      const epochsSinceLastImprovement = summary.epoch - bestSummary.epoch;
      console.info(
        `${epochsSinceLastImprovement} epochs since last improvement.`
      );
      if (epochsSinceLastImprovement > maxEpochsWithoutImprovement) {
        model.stopTraining = true;
      }

      await Promise.all([
        (async (): Promise<void> => {
          const epochModelLogDir = join(logPaths.models, `epoch-${epoch}`);
          await mkdir(epochModelLogDir);
          await model.save(`file://${epochModelLogDir.replace(/\\/g, "/")}`);
          await writeFile(
            join(epochModelLogDir, "summary.json"),
            JSON.stringify(summary, undefined, 4)
          );
        })(),
        writeFile(
          join(logPaths.predictions, `epoch-${epoch}.json`),
          JSON.stringify(pairs, undefined, 4)
        ),
        writeFile(logPaths.best, JSON.stringify(bestSummary, undefined, 4)),
      ]);
    },
  });
}

export async function run(tf: TFJS): Promise<void> {
  const dataVariant = process.argv[2] ?? "";

  const logRoot = join("./outputs", new Date().toISOString());
  const logPaths = Object.freeze<LogPaths>({
    best: join(logRoot, "best.json"),
    error: join(logRoot, "error.txt"),
    modelSummary: join(logRoot, "model-summary.txt"),
    models: join(logRoot, "models"),
    predictions: join(logRoot, "predictions"),
    root: logRoot,
    summary: join(logRoot, "summary.json"),
    tensorBoard: join(logRoot, "tensor-board"),
  } as const);

  try {
    await mkdirp(logPaths.root);
    await Promise.all([
      mkdir(logPaths.models),
      mkdir(logPaths.predictions),
      mkdir(logPaths.tensorBoard),
    ]);

    const loadedPaths = await loadSamplePaths(dataVariant);
    const validation = await prepareTensors(tf, loadedPaths.validation);

    // Create a simple model.
    const model = createModel(tf, validation.xs.shape);

    model.summary();
    await writeFile(
      logPaths.modelSummary,
      await new Promise((resolve): void => {
        const lines: string[] = [];
        model.summary(200, undefined, (msg): void => {
          lines.push(msg);
        });
        resolve(lines.join("\n"));
      })
    );

    const training = await prepareTensors(tf, loadedPaths.training);

    // Train the model using the data.
    await model.fit(training.xs.data, training.ys.data, {
      batchSize: 32,
      classWeight: training.classWeights,
      epochs: 5100,
      shuffle: true,
      validationData: [validation.xs.data, validation.ys.data],
      verbose: 1,
      callbacks: [
        createFitCallback(logPaths, model, validation, 50),
        // tf.node.tensorBoard(log.tensorBoard),
      ],
    });
  } catch (error) {
    try {
      await mkdirp(logPaths.root);
      await Promise.all([
        writeFile(
          logPaths.error,
          [error.name, "", "", error.message, "", "", error.stack].join("\n")
        ),
      ]);
    } finally {
      throw error;
    }
  }
}
