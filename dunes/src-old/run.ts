import * as models from "./models";
import type {
  CustomCallbackArgs,
  LayersModel,
  Tensor1D,
  Tensor2D,
  TensorContainer,
} from "@tensorflow/tfjs-node";
import { CreateModel } from "./models";
import {
  PreparedTensors,
  prepareSample,
  prepareTensors,
} from "./prepare-tensors";
import { TFJS } from "./tfjs";
import { appendFile, mkdir, mkdirp, move, writeFile } from "fs-extra";
import { join } from "path";
import { loadSamplePaths } from "./load-sample-paths";

interface Summary {
  epoch: number;
  epochTookMs: number;
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

interface LogBasePaths {
  readonly failed: string;
  readonly running: string;
  readonly successful: string;
}
interface LogPaths {
  readonly best: string;
  readonly config: string;
  readonly epochFileLists: string;
  readonly error: string;
  readonly modelSummary: string;
  readonly models: string;
  readonly predictions: string;
  readonly rawPredictions: string;
  readonly root: string;
  readonly series: string;
  readonly steps: string;
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

function appendSummarySeries(
  prefix: string,
  epoch: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summary: any
): Promise<void>[] {
  if (![".", "/"].includes(prefix[prefix.length - 1])) {
    throw new Error("The prefix has to end with “.” or “/”.");
  }

  return Object.entries(summary).flatMap(([key, value]): Promise<void>[] =>
    Array.isArray(value)
      ? [
          appendFile(
            (prefix + `${key}.tsv`).replace(/[$:]/g, "_"),
            [epoch, ...summary[key]].join("\t") + "\n"
          ),
        ]
      : typeof value === "object" && value !== null
      ? appendSummarySeries(`${prefix}${key}.`, epoch, value)
      : [
          appendFile(
            (prefix + `${key}.tsv`).replace(/[$:]/g, "_"),
            [epoch, summary[key]].join("\t") + "\n"
          ),
        ]
  );
}

function createFitCallback(
  logPaths: LogPaths,
  model: LayersModel,
  validation: PreparedTensors,
  stopCallback: () => void,
  maxEpochsWithoutImprovement: number
): CustomCallbackArgs {
  let bestSummary: Summary | null = null;
  let epochStartUnix = Date.now();
  return Object.freeze<CustomCallbackArgs>({
    onEpochBegin(): void {
      epochStartUnix = Date.now();
    },
    async onEpochEnd(epoch, logs): Promise<void> {
      const epochTookMs = Date.now() - epochStartUnix;

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
        epochTookMs,
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
        stopCallback();
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
          join(logPaths.rawPredictions, `epoch-${epoch}.expected.json`),
          JSON.stringify(expectedYs, undefined, 4)
        ),
        writeFile(
          join(logPaths.rawPredictions, `epoch-${epoch}.actual.json`),
          JSON.stringify(actualYs, undefined, 4)
        ),
        writeFile(
          join(logPaths.predictions, `epoch-${epoch}.json`),
          JSON.stringify(pairs, undefined, 4)
        ),
        appendFile(
          logPaths.steps,
          JSON.stringify(summary, undefined, 4) + ",\n"
        ),
        ...appendSummarySeries(logPaths.series + "/", epoch, summary),
        writeFile(logPaths.best, JSON.stringify(bestSummary, undefined, 4)),
      ]);
    },
  });
}

function getTimestamp(): string {
  const now = new Date();
  return [
    [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map((v): string => ("" + v).padStart(2, "0"))
      .join("-"),
    [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((v): string => ("" + v).padStart(2, "0"))
      .join("-"),
  ].join("T");
}

export async function run(tf: TFJS, mode: string): Promise<void> {
  const config = Object.freeze({
    argv: process.argv,
    maxEpochsTotal: +(process.argv[2] ?? 1000),
    maxEpochsWithoutImprovement: +(process.argv[3] ?? 50),
    batchSize: +(process.argv[4] ?? 32),
    fitVariant: process.argv[5],
    dataVariant: process.argv[6] ?? "",
    modelVariant: process.argv[7] ?? "",
    modelParams: process.argv.slice(8).map((v): number => +v),
  } as const);

  const logRoot = join(
    "./outputs",
    [
      getTimestamp(),
      config.dataVariant,
      config.fitVariant,
      config.modelVariant,
      config.modelParams.join("-"),
      mode,
    ].join("_")
  );
  const logBasePaths = Object.freeze<LogBasePaths>({
    running: logRoot + "_running",
    failed: logRoot + "_failed",
    successful: logRoot + "_successful",
  } as const);
  const logPaths = Object.freeze<LogPaths>({
    best: join(logBasePaths.running, "best.json"),
    config: join(logBasePaths.running, "config.json"),
    epochFileLists: join(logBasePaths.running, "epoch-file-lists"),
    error: join(logBasePaths.running, "error.txt"),
    modelSummary: join(logBasePaths.running, "model-summary.txt"),
    models: join(logBasePaths.running, "models"),
    predictions: join(logBasePaths.running, "predictions"),
    rawPredictions: join(logBasePaths.running, "raw-predictions"),
    root: logBasePaths.running,
    series: join(logBasePaths.running, "series"),
    steps: join(logBasePaths.running, "steps.jsons"),
    summary: join(logBasePaths.running, "summary.json"),
    tensorBoard: join(logBasePaths.running, "tensor-board"),
  } as const);

  try {
    await mkdirp(logPaths.root);
    await Promise.all([
      mkdir(logPaths.epochFileLists),
      mkdir(logPaths.models),
      mkdir(logPaths.predictions),
      mkdir(logPaths.rawPredictions),
      mkdir(logPaths.series),
      mkdir(logPaths.tensorBoard),
      writeFile(logPaths.config, JSON.stringify(config, undefined, 4)),
    ]);

    const loadedPaths = await loadSamplePaths(config.dataVariant);

    const { validation } = await (async (): Promise<{
      validation: PreparedTensors;
    }> => {
      await writeFile(
        join(logPaths.epochFileLists, "validation.paths.json"),
        JSON.stringify(loadedPaths.validation, undefined, 4)
      );

      console.time("Validation data");
      const validation = await prepareTensors(tf, loadedPaths.validation);
      console.timeEnd("Validation data");

      await writeFile(
        join(logPaths.epochFileLists, "validation.weights.json"),
        JSON.stringify(validation.classWeights, undefined, 4)
      );

      return {
        validation,
      };
    })();

    // console.log(process.memoryUsage());
    console.log("Shapes: ", validation.xs.shape, validation.ys.shape);

    // Create a simple model.
    const model = await (async (): Promise<LayersModel> => {
      const [, createModel]:
        | [string, CreateModel]
        | [null, null] = Object.entries(models).find(
        ([name]): boolean =>
          name.startsWith("createModel") &&
          name.slice("createModel".length) === config.modelVariant
      ) ?? [null, null];
      if (createModel == null) {
        throw new Error(`Invalid model: “${config.modelVariant}”.`);
      }

      const model = createModel(tf, validation.xs.shape, ...config.modelParams);

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

      return model;
    })();

    if (config.maxEpochsTotal === 0) {
      // noop
    } else if (config.fitVariant === "d") {
      // Train the model using the data.
      await model.fitDataset(
        tf.data
          .generator(
            async (): Promise<
              Iterator<TensorContainer, undefined, undefined>
            > => {
              const paths = loadedPaths.getBalancedTraining();
              await writeFile(
                join(logPaths.epochFileLists, `${getTimestamp()}.json`),
                JSON.stringify(
                  { training: paths, validation: loadedPaths.validation },
                  undefined,
                  4
                )
              );

              console.time("Samples");
              const samples = await Promise.all(
                paths.map(
                  (path): Promise<{ xs: Tensor2D; ys: Tensor1D }> =>
                    prepareSample(tf, path)
                )
              );
              console.timeEnd("Samples");

              return (function* (): Iterator<
                TensorContainer,
                undefined,
                undefined
              > {
                for (const sample of samples) {
                  yield sample;
                }

                return;
              })();
            }
          )
          .batch(config.batchSize),
        {
          epochs: config.maxEpochsTotal,
          verbose: 1,
          validationData: [validation.xs.data, validation.ys.data],
          callbacks: [
            createFitCallback(
              logPaths,
              model,
              validation,
              (): void => {
                model.stopTraining = true;
              },
              config.maxEpochsWithoutImprovement
            ),
            // tf.node.tensorBoard(log.tensorBoard),
          ],
        }
      );
    } else {
      const { training } = await (async (): Promise<{
        training: PreparedTensors;
      }> => {
        await writeFile(
          join(logPaths.epochFileLists, "training.paths.json"),
          JSON.stringify(loadedPaths.training, undefined, 4)
        );

        console.time("Training data");
        const training = await prepareTensors(tf, loadedPaths.training);
        console.timeEnd("Training data");

        await writeFile(
          join(logPaths.epochFileLists, "training.weights.json"),
          JSON.stringify(training.classWeights, undefined, 4)
        );

        return {
          training,
        };
      })();

      // Train the model using the data.
      await model.fit(training.xs.data, training.ys.data, {
        batchSize: config.batchSize,
        classWeight:
          config.fitVariant === "b" ? training.classWeights : undefined,
        epochs: config.maxEpochsTotal,
        shuffle: true,
        validationData: [validation.xs.data, validation.ys.data],
        verbose: 1,
        callbacks: [
          createFitCallback(
            logPaths,
            model,
            validation,
            (): void => {
              model.stopTraining = true;
            },
            config.maxEpochsWithoutImprovement
          ),
          // tf.node.tensorBoard(log.tensorBoard),
        ],
      });
    }

    await move(logBasePaths.running, logBasePaths.successful);
  } catch (runError) {
    try {
      await mkdirp(logPaths.root);
      await Promise.all([
        writeFile(
          logPaths.error,
          [
            runError.name,
            "",
            "",
            runError.message,
            "",
            "",
            runError.stack,
          ].join("\n")
        ),
      ]);
    } catch (writeError) {
      console.error(writeError);
    } finally {
      try {
        await move(logBasePaths.running, logBasePaths.failed);
      } catch (moveError) {
        console.error(moveError);
      } finally {
        throw runError;
      }
    }
  }
}
