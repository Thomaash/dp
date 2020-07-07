/* eslint-disable no-console */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, resolve } from "path";

import { OTTimetable } from "./ot-timetable";

interface RunDelays {
  readonly perCategoryDiffs: ReadonlyMap<string, number>;
  readonly perTrainDiffs: ReadonlyMap<string, number>;
}
interface Run {
  readonly delays: RunDelays;
  readonly id: string;
  readonly module: string;
  readonly scenario: number;
  readonly trainIDs: readonly string[];
  readonly xx: number;
  readonly xxTrainIDs: string[];
}

const outputPath = process.argv[2];
const REQUIRED_FILES = ["OT_Timetable.txt"];

function shiftRight(input: string): string;
function shiftRight(input: readonly string[]): string[];
function shiftRight(input: string | readonly string[]): string | string[] {
  if (typeof input === "string") {
    return shiftRightString(input);
  } else {
    return shiftRightLines(input);
  }
}

function shiftRightString(string: string): string {
  return shiftRightLines(string.split("\n")).join("\n");
}
function shiftRightLines(lines: readonly string[]): string[] {
  return lines.map((line): string => "    " + line);
}

function nOutOf(n: number, total: number): string {
  return `${n}/${total} (${Math.round((n / total) * 100)}%)`;
}

function getSuffix(dirname: string): string {
  return dirname.replace(/^variant-/, "");
}

function toCSV<Key extends string | number | symbol>(
  rows: readonly Record<Key, string>[],
  delimiter: string,
  keys: readonly Key[]
): string {
  const lines = [keys.join(delimiter)];

  for (const row of rows) {
    lines.push(keys.map((key): string => row[key] ?? "").join(delimiter));
  }

  return lines.join("\n");
}

function getXX(runs: readonly Run[]): string[] {
  return getFailedRunSummary(
    runs,
    (run): readonly string[] => run.trainIDs,
    [...runs].filter((run): boolean => run.xx > 0),
    (run): readonly string[] => run.xxTrainIDs
  );
}

function getFailedRunSummary(
  allRuns: readonly Run[],
  reduceTotal: (run: Run) => readonly unknown[],
  failedRuns: readonly Run[],
  reduceFailed: (run: Run) => readonly unknown[]
): string[] {
  return [
    `${nOutOf(failedRuns.length, allRuns.length)}:`,
    ...shiftRight(
      [...new Set([...failedRuns.map((run): string => run.module)])]
        .sort()
        .flatMap((module): string[] => {
          const failedModuleRuns = failedRuns.filter(
            (run): boolean => run.module === module
          );
          const allModuleRuns = allRuns.filter(
            (run): boolean => run.module === module
          );

          return [
            `${module} ${nOutOf(
              failedModuleRuns.length,
              allModuleRuns.length
            )}:`,
            ...shiftRight(
              [...failedModuleRuns]
                .sort((a, b): number => a.scenario - b.scenario)
                .map(
                  (run): string =>
                    `#${run.scenario} ${nOutOf(
                      reduceFailed(run).length,
                      reduceTotal(run).length
                    )}, trains: ${reduceFailed(run).join(", ")}`
                )
            ),
          ];
        })
    ),
  ];
}

function getScenarios(runs: readonly Run[]): number[] {
  return [...new Set(runs.map((run): number => run.scenario))].sort(
    (a, b): number => a - b
  );
}

function getNumberOfRuns(runs: readonly Run[]): number {
  return new Set<string>(runs.map((run): string => run.id)).size;
}

function loadResults(): {
  runs: Run[];
} {
  const runs: Run[] = [];

  const allDirnames = readdirSync(outputPath, { withFileTypes: true })
    .filter((dirent): boolean => dirent.isDirectory())
    .map((dirent): string => dirent.name);
  const modules = new Set(
    allDirnames.map((dirname): string => getSuffix(dirname))
  );

  for (const module of modules) {
    const runDirnames = allDirnames.filter(
      (dirname): boolean => getSuffix(dirname) === module
    );
    runDir: for (const runDirname of runDirnames) {
      for (const requiredFile of REQUIRED_FILES) {
        const requiredFilePath = resolve(outputPath, runDirname, requiredFile);
        if (!existsSync(requiredFilePath)) {
          console.warn(
            `Warning: ${requiredFilePath} doesn't exist, skipping ${resolve(
              outputPath,
              runDirname
            )}.`
          );
          continue runDir;
        }
      }

      const otTimettableModule = new OTTimetable(
        readFileSync(
          resolve(outputPath, runDirname, "OT_Timetable.txt"),
          "utf-8"
        )
      );

      const scenarios = [
        ...new Set(
          otTimettableModule.query().map((record): number => record.scenario)
        ),
      ];

      for (const scenario of scenarios) {
        const otTimettable = new OTTimetable(
          otTimettableModule.query({ scenario })
        );
        const trainIDs = [...otTimettable.getTrainIDs()];

        const xxTrainIDs = [...otTimettable.getXXTrainIDs()];
        const xx = xxTrainIDs.length;
        const perCategoryDiffs = otTimettable.getGroupedBeginEndDelayDiffs(
          (course): [string, string] => ["total", course.split(" ", 1)[0]]
        );
        const perTrainDiffs = otTimettable.getBeginEndDelayDiffs();

        const run: Run = {
          delays: { perCategoryDiffs, perTrainDiffs },
          id: `${module}/${scenario}`,
          module: module,
          scenario,
          trainIDs,
          xx,
          xxTrainIDs,
        };

        runs.push(run);
      }
    }
  }

  return { runs };
}

function getModules(runs: readonly Run[]): string[] {
  return [...new Set(runs.map((run): string => run.module))].sort();
}

function csvHeader(text: string, module: string): string {
  return `${text} (${module})`;
}

function buildCSV(
  allRuns: readonly Run[],
  type: "perCategoryDiffs" | "perTrainDiffs"
): string {
  const modules = getModules(allRuns);
  const scenarios = getScenarios(allRuns);

  const diffCategories = [
    ...new Set(
      allRuns.flatMap((run): string[] => [...run.delays[type].keys()])
    ),
  ].sort();

  const modulesAndDiffCategories = modules.flatMap((module): {
    diffCategory: string;
    module: string;
  }[] =>
    diffCategories.map((diffCategory): {
      diffCategory: string;
      module: string;
    } => ({ diffCategory, module }))
  );

  const keys = [
    "scenario",
    ...modules.flatMap((module): string[] => [
      "",
      ...diffCategories
        .filter((diffCategory): boolean => diffCategory !== "total")
        .map((diffCategory): string => csvHeader(diffCategory, module)),
      csvHeader("total", module),
    ]),
  ];
  const rows = scenarios
    // Skip runs where all modules are not (yet) available.
    .filter(
      (scenario): boolean =>
        new Set(
          allRuns
            .filter((run): boolean => run.scenario === scenario)
            .map((run): string => run.module)
        ).size === modules.length
    )
    // Turn runs into CSV rows.
    .map(
      (scenario): Record<string, string> => {
        const runs = allRuns.filter(
          (run): boolean => run.scenario === scenario
        );

        return {
          scenario: "" + scenario,
          ...modulesAndDiffCategories.reduce<Record<string, string>>(
            (acc, { diffCategory, module }): Record<string, string> => {
              const run = runs.find((run): boolean => run.module === module);
              if (run == null) {
                throw new Error(`Can't find for "${module}" #${scenario}.`);
              }

              const delay = run.delays[type].get(diffCategory);
              if (delay == null) {
                throw new Error(
                  `Can't find "${diffCategory}" delays in "${module}" #${scenario}.`
                );
              }

              // In minutes for now.
              // TODO: Evaluate ideal units/format.
              acc[csvHeader(diffCategory, module)] = "" + delay / 60;

              return acc;
            },
            {}
          ),
        };
      }
    );

  return toCSV(rows, ",", keys);
}

export function processOutputs(): string {
  const lines: string[] = [];

  const { runs: allRuns } = loadResults();
  lines.push("");

  if (allRuns.length >= 2) {
    lines.push(`==> Summary`, "");

    const modules = getModules(allRuns);
    const numberOfRuns = getNumberOfRuns(allRuns);
    const xx = getXX(allRuns).join("\n");

    lines.push(
      `Number of runs: ${numberOfRuns}`,
      ...shiftRight(
        modules.map((module): string => {
          const sum = allRuns
            .filter((run): boolean => run.module === module)
            .reduce<number>((acc): number => acc + 1, 0);

          return `${module}: ${nOutOf(sum, numberOfRuns)}`;
        })
      )
    );

    lines.push("Some trains never reached some stations: " + xx);
  }

  for (const type of ["perCategoryDiffs", "perTrainDiffs"] as const) {
    const csv = buildCSV(allRuns, type);
    writeFileSync(
      resolve(outputPath, `${basename(outputPath)}.delays.${type}.csv`),
      csv
    );
  }

  lines.push("");
  return lines.join("\n");
}
