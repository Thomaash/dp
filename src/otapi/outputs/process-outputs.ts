/* eslint-disable no-console */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import { sync as globbySync } from "globby";
import { cumsum, mean, normalci } from "jstat";

import { OTTimetable } from "./ot-timetable";
import { MapCounter } from "../../util";

interface RunDelays {
  readonly perCategoryDiffs: ReadonlyMap<string, number>;
  readonly perTrainDiffs: ReadonlyMap<string, number>;
}
type RunDelayType = keyof RunDelays;
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

const ALPHA = 0.05;
const REQUIRED_FILES = ["OT_Timetable.txt"];

const HEADER_CIM = "CI-";
const HEADER_CMA = "CMA";
const HEADER_CIP = "CI+";

const collator = new Intl.Collator(undefined, { numeric: true });
const cmp = collator.compare.bind(collator);
const cmpProp = <T extends string | number | symbol>(
  prop: T
): ((
  a: Record<T, string | number>,
  b: Record<T, string | number>
) => number) => (a, b): number => collator.compare("" + a[prop], "" + b[prop]);

// TODO: This should be configurable.
const catIntercity = (trainID: string): string[] =>
  /^(Ex|R) /.test(trainID) ? ["intercity"] : [];
const catCommuter = (trainID: string): string[] =>
  /^(Sp|Os) /.test(trainID) ? ["commuter"] : [];
const catPassenger = (trainID: string): string[] =>
  /^(Ex|R|Sp|Os) /.test(trainID) ? ["passenger"] : [];
const catFreight = (trainID: string): string[] =>
  /^(Nex|Pn|Mn) /.test(trainID) ? ["freight"] : [];

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
        .sort(cmpProp("name"))
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
    .map((path): Module => getModule(path))
    .sort(cmpProp("name"));

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
        (trainID): string[] => [
          "total",
          trainID.split(" ", 1)[0],
          ...catIntercity(trainID),
          ...catCommuter(trainID),
          ...catPassenger(trainID),
          ...catFreight(trainID),
        ]
      );
      const perTrainDiffs = otTimettable.getBeginEndDelayDiffs();

      const run: Run = {
        delays: { perCategoryDiffs, perTrainDiffs },
        id: `${module}#${scenario}`,
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

function csvHeader(text: string, module: Module, variant?: string): string {
  return [text, module.name, variant]
    .filter((value): value is string => typeof value === "string")
    .join(" | ");
}
function csvHeaders(
  text: string,
  module: Module,
  variants: readonly string[]
): string[] {
  return variants.map((variant): string => csvHeader(text, module, variant));
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

interface CSVPreparedRowData {
  scenario: number;
  runs: Run[];
}

function secondsToCSVValue(seconds: number): string {
  // TODO: Minutes, evaluate ideal units/format.
  return "" + seconds / 60;
}

function filterRunsForCSV(
  { runs: allRuns }: Result,
  requireOtsimcor: number,
  ignoreScenarios: boolean,
  skipXX: boolean
): Run[] {
  const perModuleRunCounters = new MapCounter<Module>();
  return (
    allRuns
      // Skip runs where not all otsimcors are available or some were deleted.
      .filter((run): boolean =>
        checkOtsimcors(run.module, run.scenario, requireOtsimcor)
      )
      // Skip runs where some trains didn't finish.
      .filter((run): boolean => skipXX === false || run.xx === 0)
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
      )
  );
}

function prepareDataForCSV(
  result: Result,
  requireOtsimcor: number,
  ignoreScenarios: boolean,
  skipXX: boolean
): CSVPreparedRowData[] {
  const { modules } = result;
  const filteredRuns = filterRunsForCSV(
    result,
    requireOtsimcor,
    ignoreScenarios,
    skipXX
  );

  return (
    getScenarios(filteredRuns)
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
      // Turn runs into raw CSV row data.
      .map(
        (scenario): CSVPreparedRowData => {
          const runs = filteredRuns.filter(
            (run): boolean => run.scenario === scenario
          );

          return { runs, scenario };
        }
      )
  );
}

function getDelay(
  runs: readonly Run[],
  module: Module,
  type: RunDelayType,
  scenario: number,
  diffCategory: string
): number {
  const run = runs.filter((run): boolean => run.module.name === module.name);
  if (run.length < 1) {
    throw new Error(`Can't find run for "${module.name}#${scenario}".`);
  }
  if (run.length > 1) {
    throw new Error(
      `Too many runs (${run.length}) found for "${module.name}#${scenario}".`
    );
  }

  const delay = run[0].delays[type].get(diffCategory);
  if (delay == null) {
    throw new Error(`Can't find "${diffCategory}" delays in "${run[0].id}".`);
  }

  return delay;
}

function buildCSV(
  result: Result,
  type: RunDelayType,
  requireOtsimcor: number,
  ignoreScenarios: boolean,
  skipXX: boolean
): string {
  const { runs: allRuns, modules } = result;

  const { cats, modCats } = getModCats(allRuns, modules, type);

  const keys = [
    "scenario",
    ...modules.flatMap((module): string[] => [
      "",
      ...cats
        .filter((diffCategory): boolean => diffCategory !== "total")
        .map((diffCategory): string => csvHeader(diffCategory, module)),
      csvHeader("total", module),
    ]),
  ];

  const rows = prepareDataForCSV(
    result,
    requireOtsimcor,
    ignoreScenarios,
    skipXX
  )
    // Turn runs into CSV rows.
    .map(
      ({ runs, scenario }): Record<string, string> => {
        return {
          ...modCats.reduce<Record<string, string>>(
            (acc, { diffCategory, module }): Record<string, string> => {
              acc[csvHeader(diffCategory, module)] = secondsToCSVValue(
                getDelay(runs, module, type, scenario, diffCategory)
              );

              return acc;
            },
            {}
          ),
          scenario: "" + scenario,
        };
      }
    );

  return toCSV(rows, ",", keys);
}

interface ModCat {
  diffCategory: string;
  module: Module;
}
function getModCats(
  runs: readonly Run[],
  modules: readonly Module[],
  type: RunDelayType
): { cats: string[]; modCats: ModCat[] } {
  const cats = [
    ...new Set(runs.flatMap((run): string[] => [...run.delays[type].keys()])),
  ].sort(cmp);

  const modCats = modules.flatMap((module): ModCat[] =>
    cats.map((diffCategory): {
      diffCategory: string;
      module: Module;
    } => ({ diffCategory, module }))
  );

  return { cats, modCats };
}

function buildCICSV(
  result: Result,
  type: RunDelayType,
  requireOtsimcor: number,
  ignoreScenarios: boolean,
  skipXX: boolean
): string {
  const { runs: allRuns, modules } = result;

  const { cats, modCats } = getModCats(allRuns, modules, type);

  const keys = [
    "scenario",
    ...modules.flatMap((module): string[] => [
      ...cats
        .filter((diffCategory): boolean => diffCategory !== "total")
        .flatMap((diffCategory): string[] =>
          csvHeaders(diffCategory, module, [HEADER_CIM, HEADER_CMA, HEADER_CIP])
        ),
      ...csvHeaders("total", module, [HEADER_CIM, HEADER_CMA, HEADER_CIP]),
    ]),
  ];

  const rows = prepareDataForCSV(
    result,
    requireOtsimcor,
    ignoreScenarios,
    skipXX
  )
    // Turn runs into CSV rows.
    .map(({ scenario }, index, array): null | Record<string, string> => {
      if (index < 2) {
        return null;
      }

      return {
        ...modCats.reduce<Record<string, string>>(
          (acc, { diffCategory, module }): Record<string, string> => {
            const delayCMAs = cumsum(
              array
                .slice(0, index + 1)
                .map(({ runs }): number =>
                  getDelay(runs, module, type, scenario, diffCategory)
                )
            ).map(
              (cumulativeDelaySum, index): number =>
                cumulativeDelaySum / (index + 1)
            );

            acc[
              csvHeader(diffCategory, module, HEADER_CMA)
            ] = secondsToCSVValue(delayCMAs[delayCMAs.length - 1]);

            const [low, high] = normalci(
              delayCMAs[delayCMAs.length - 1],
              ALPHA,
              delayCMAs.slice(0, -1)
            );
            acc[
              csvHeader(diffCategory, module, HEADER_CIP)
            ] = secondsToCSVValue(high);
            acc[
              csvHeader(diffCategory, module, HEADER_CIM)
            ] = secondsToCSVValue(low);

            return acc;
          },
          {}
        ),
        scenario: "" + scenario,
      };
    })
    // CI requires at least two values to be computed so the first one will be
    // null and should be omitted.
    .filter((value): value is Record<string, string> => value != null);

  return toCSV(rows, ",", keys);
}

function computeAverageDelay(
  runs: readonly Run[],
  type: RunDelayType,
  categories: readonly string[]
): number {
  return mean(
    runs.flatMap((run): number[] =>
      categories.map((diffCategory): number => {
        const delay = run.delays[type].get(diffCategory);
        if (delay == null) {
          throw new Error(
            `Can't find "${diffCategory}" delays in "${run.id}".`
          );
        }

        return delay;
      })
    )
  );
}

function buildAvgCSV(
  result: Result,
  type: RunDelayType,
  requireOtsimcor: number,
  ignoreScenarios: boolean,
  skipXX: boolean
): string {
  const { runs: allRuns, modules } = result;

  const diffCategories = [
    ...new Set(
      allRuns.flatMap((run): string[] => [...run.delays[type].keys()])
    ),
  ].sort(cmp);

  const keys = [
    "module",
    ...diffCategories.filter(
      (diffCategory): boolean => diffCategory !== "total"
    ),
    "total",
  ];

  const filteredRuns = filterRunsForCSV(
    result,
    requireOtsimcor,
    ignoreScenarios,
    skipXX
  );

  // Turn runs into CSV rows.
  const rows = modules.map(
    (module): Record<string, string> => {
      const runs = filteredRuns.filter(
        (run): boolean => run.module.name === module.name
      );

      return {
        ...diffCategories.reduce<Record<string, string>>(
          (acc, diffCategory): Record<string, string> => {
            acc[diffCategory] = secondsToCSVValue(
              computeAverageDelay(runs, type, [diffCategory])
            );

            return acc;
          },
          {}
        ),
        module: module.name,
        total: secondsToCSVValue(
          computeAverageDelay(runs, type, diffCategories)
        ),
      };
    }
  );

  return toCSV(rows, ",", keys);
}

export function processOutputs({
  ignoreScenarios,
  outputPath,
  requireOtsimcor,
  skipXX,
}: {
  ignoreScenarios: boolean;
  outputPath: string;
  requireOtsimcor: number;
  skipXX: boolean;
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
    const dataCSV = buildCSV(
      result,
      type,
      requireOtsimcor,
      ignoreScenarios,
      skipXX
    );
    writeFileSync(
      resolve(outputPath, `${basename(outputPath)}.delays.${type}.csv`),
      dataCSV
    );

    const ciCSV = buildCICSV(
      result,
      type,
      requireOtsimcor,
      ignoreScenarios,
      skipXX
    );
    writeFileSync(
      resolve(outputPath, `${basename(outputPath)}.ci.${type}.csv`),
      ciCSV
    );

    const avgCSV = buildAvgCSV(
      result,
      type,
      requireOtsimcor,
      ignoreScenarios,
      skipXX
    );
    writeFileSync(
      resolve(outputPath, `${basename(outputPath)}.avg.${type}.csv`),
      avgCSV
    );
  }

  lines.push("");
  return lines.join("\n");
}
