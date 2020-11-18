import {
  appendFileSync,
  ensureDirSync,
  readdirSync,
  writeFileSync,
} from "fs-extra";
import { format } from "prettier";
import { join } from "path";

import { FitStat, FitStats, InputConfig, Statement } from "../index-no-runner";
import { RunSummary } from "./common";

function saveStatement<Inputs extends InputConfig>(
  path: string,
  specimen: Statement<Inputs>,
  fit: FitStats
): void {
  writeFileSync(
    path,
    format(
      [
        `export const fitStats = ${JSON.stringify(
          fit,
          (_k: string, v: unknown): unknown =>
            v === Number.POSITIVE_INFINITY ? Number.MAX_VALUE : v,
          2
        )};`,
        "",
        `export ${specimen.function}`,
      ].join("\n"),
      { filepath: "file.js", endOfLine: "lf" }
    )
  );
}

export function createSimpleRunSaver<Inputs extends InputConfig>(
  path: string,
  {
    data,
    saveEveryRun = false,
    saveSummary = [],
    saveWinners = 0,
  }: {
    data?: readonly [number, Inputs, ...unknown[]][];
    saveEveryRun?: boolean;
    saveSummary?: readonly (keyof FitStat)[];
    saveWinners?: number;
  }
): (runSummary: RunSummary<Inputs>) => void {
  ensureDirSync(path);
  if (readdirSync(path).length > 0) {
    throw new Error(`Target folder “${path}” isn't empty.`);
  }

  if (Array.isArray(data) && data.length > 0) {
    const keys: readonly (keyof Inputs)[] = Object.keys(data[0][1]).sort();
    writeFileSync(
      join(path, "data.csv"),
      [
        ["", ...keys],
        ...data.map(([nm, inputs, ...results]): unknown[] => [
          nm,
          ...keys.map((key): unknown => inputs[key]),
          ...results,
        ]),
      ]
        .map((row): string => row.join("\t"))
        .join("\n")
    );
  }

  const summaryPath = join(path, "summary.csv");
  if (saveSummary.length > 0) {
    writeFileSync(
      summaryPath,
      [
        "run",
        ...new Array(saveWinners)
          .fill(null)
          .flatMap((_v, i): string[] =>
            saveSummary.map((type): string => `specimen ${i + 1} - ${type}`)
          ),
      ].join("\t") + "\n"
    );
  }

  return (runSummary): void => {
    const runPath = join(path, "" + runSummary.number);
    ensureDirSync(runPath);

    if (saveEveryRun) {
      runSummary.specimens.forEach(({ fit, specimen }, i): void => {
        saveStatement(join(runPath, `${i + 1}.js`), specimen, fit);
      });
    }

    if (saveSummary.length > 0) {
      appendFileSync(
        summaryPath,
        [
          runSummary.number,
          ...runSummary.specimens.slice(0, saveWinners).flatMap((_v, i): (
            | number
            | null
          )[] => {
            const fit: {
              [Key in keyof FitStat]: FitStat[Key] | null;
            } = runSummary.specimens[i]?.fit.validation ?? {
              combined: null,
              fit: null,
              penalty: null,
            };
            return saveSummary.map((type): number | null => fit[type]);
          }),
        ].join("\t") + "\n"
      );
    }

    if (saveWinners > 0) {
      runSummary.specimens
        .slice(0, saveWinners)
        .forEach(({ fit, specimen }, i): void => {
          saveStatement(join(path, `winner.${i + 1}.js`), specimen, fit);
        });
    }
  };
}
