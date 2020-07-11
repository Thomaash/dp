/* eslint-disable no-console */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import { sync as globbySync } from "globby";

import { OTTimetable } from "./ot-timetable";
import { MapCounter } from "../../util";

interface RunDelays {
  readonly perCategoryDiffs: ReadonlyMap<string, number>;
  readonly perTrainDiffs: ReadonlyMap<string, number>;
}
interface Module {
  readonly name: string;
  readonly path: string;
}
interface Run {
  readonly delays: RunDelays;
  readonly id: string;
  readonly module: Module;
  readonly scenario: number;
  readonly trainIDs: readonly string[];
  readonly xx: number;
  readonly xxTrainIDs: string[];
}
interface Result {
  readonly modules: readonly Module[];
  readonly runs: readonly Run[];
}

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

function getModule(path: string): Module {
  const name = basename(path);
  return { name, path };
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
      [...new Set([...failedRuns.map((run): Module => run.module)])]
        .sort()
        .flatMap((module): string[] => {
          const failedModuleRuns = failedRuns.filter(
            (run): boolean => run.module.name === module.name
          );
          const allModuleRuns = allRuns.filter(
            (run): boolean => run.module.name === module.name
          );

          return [
            `${module.name} ${nOutOf(
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

function loadResult(outputPath: string): Result {
  const runs: Run[] = [];

  const modules = readdirSync(outputPath, { withFileTypes: true })
    .filter((dirent): boolean => dirent.isDirectory())
    .map((dirent): string => dirent.name)
    .map((dirname): string => resolve(outputPath, dirname))
    .map((path): Module => getModule(path));

  modules: for (const module of modules) {
    for (const requiredFile of REQUIRED_FILES) {
      const requiredFilePath = resolve(module.path, requiredFile);
      if (!existsSync(requiredFilePath)) {
        console.warn(
          `Warning: ${requiredFilePath} doesn't exist, skipping ${module.path}.`
        );
        continue modules;
      }
    }

    const otTimettableModule = new OTTimetable(
      readFileSync(resolve(module.path, "OT_Timetable.txt"), "utf-8")
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

  return { modules, runs };
}

function csvHeader(text: string, module: Module): string {
  return `${text} (${module.name})`;
}

function checkOtsimcors(
  module: Module,
  scenario: number,
  min: number
): boolean {
  return (
    globbySync(
      resolve(module.path.replace(/[{}*?!]/g, "\\$&"), `*.${scenario}.otsimcor`)
    ).length >= min
  );
}

function buildCSV(
  { runs: allRuns, modules }: Result,
  type: "perCategoryDiffs" | "perTrainDiffs",
  requireOtsimcor: number,
  ignoreScenarios: boolean
): string {
  const diffCategories = [
    ...new Set(
      allRuns.flatMap((run): string[] => [...run.delays[type].keys()])
    ),
  ].sort();

  const modulesAndDiffCategories = modules.flatMap((module): {
    diffCategory: string;
    module: Module;
  }[] =>
    diffCategories.map((diffCategory): {
      diffCategory: string;
      module: Module;
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

  const perModuleRunCounters = new MapCounter<Module>();
  const filteredRuns = allRuns
    // Skip runs where not all otsimcors are available or some were deleted.
    .filter((run): boolean =>
      checkOtsimcors(run.module, run.scenario, requireOtsimcor)
    )
    // Overwrite scenarios if configured.
    .map(
      (run): Run => {
        if (ignoreScenarios) {
          const counter = perModuleRunCounters.get(run.module);
          const scenario = counter.get();
          counter.inc();

          return {
            ...run,
            scenario,
          };
        } else {
          return { ...run };
        }
      }
    );

  const rows = getScenarios(filteredRuns)
    // Skip runs where all modules are not (yet) available.
    .filter((scenario): boolean => {
      return (
        new Set(
          filteredRuns
            .filter((run): boolean => run.scenario === scenario)
            .map((run): string => run.module.name)
        ).size === modules.length
      );
    })
    // Turn runs into CSV rows.
    .map(
      (scenario): Record<string, string> => {
        const runs = filteredRuns.filter(
          (run): boolean => run.scenario === scenario
        );

        return {
          scenario: "" + scenario,
          ...modulesAndDiffCategories.reduce<Record<string, string>>(
            (acc, { diffCategory, module }): Record<string, string> => {
              const run = runs.find(
                (run): boolean => run.module.name === module.name
              );
              if (run == null) {
                throw new Error(
                  `Can't find for "${module.name}" #${scenario}.`
                );
              }

              const delay = run.delays[type].get(diffCategory);
              if (delay == null) {
                throw new Error(
                  `Can't find "${diffCategory}" delays in "${module.name}" #${scenario}.`
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
    )
    .map(
      (row, i): Record<string, string> => ({
        ...row,
        scenario: ignoreScenarios ? "" + i : row.scenario,
      })
    );

  return toCSV(rows, ",", keys);
}

export function processOutputs({
  ignoreScenarios,
  outputPath,
  requireOtsimcor,
}: {
  ignoreScenarios: boolean;
  outputPath: string;
  requireOtsimcor: number;
}): string {
  const lines: string[] = [];

  const result = loadResult(outputPath);
  lines.push("");

  if (result.runs.length >= 2) {
    lines.push(`==> Summary`, "");

    const moduleNames = result.modules.map((module): string => module.name);
    const numberOfRuns = getNumberOfRuns(result.runs);
    const xx = getXX(result.runs).join("\n");

    lines.push(
      `Number of runs: ${numberOfRuns}`,
      ...shiftRight(
        moduleNames.map((moduleName): string => {
          const sum = result.runs
            .filter((run): boolean => run.module.name === moduleName)
            .reduce<number>((acc): number => acc + 1, 0);

          return `${moduleName}: ${nOutOf(sum, numberOfRuns)}`;
        })
      )
    );

    lines.push("Some trains never reached some stations: " + xx);
  }

  for (const type of ["perCategoryDiffs", "perTrainDiffs"] as const) {
    const csv = buildCSV(result, type, requireOtsimcor, ignoreScenarios);
    writeFileSync(
      resolve(outputPath, `${basename(outputPath)}.delays.${type}.csv`),
      csv
    );
  }

  lines.push("");
  return lines.join("\n");
}
