/* eslint-disable no-console */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import { formatDistanceStrict } from "date-fns";

import { OTMessages } from "./ot-messages";
import { OTTimetableStatistics } from "./ot-timetable-statistics";

interface RunDelays {
  readonly perCategoryDiffs: ReadonlyMap<string, number>;
  readonly perCourseDiffs: ReadonlyMap<string, number>;
}
interface Run {
  readonly date: Date;
  readonly delays: RunDelays;
  readonly id: string;
  readonly module: string;
  readonly runNumber: number;
  readonly stuck: number;
  readonly stuckCourseIDs: readonly string[];
  readonly trainIDs: readonly string[];
  readonly xx: number;
  readonly xxCourseIDs: string[];
}

const outputPath = process.argv[2];

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
  return dirname.replace(/^run-\d+-/, "");
}

function formatIntoColumns(...columns: readonly string[]): string {
  const columnLines = columns.map((columnText): string[] =>
    columnText.split("\n")
  );
  const widths = columnLines.map((lines): number =>
    lines.reduce((acc, line): number => Math.max(acc, line.length), 0)
  );
  const height = columnLines.reduce((acc, lines): number => {
    return Math.max(acc, lines.length);
  }, 0);

  const fixedSizeColumnLines = columnLines.map((lines, i): string[] => {
    const fixedSizeLines = lines.slice();
    while (fixedSizeLines.length < height) {
      fixedSizeLines.push("");
    }

    return fixedSizeLines.map((line): string => line.padEnd(widths[i], " "));
  });

  const lines: string[] = [];
  for (let i = 0; i < height; ++i) {
    lines.push(
      fixedSizeColumnLines.map((lines): string => lines[i]).join("      ")
    );
  }
  return lines.join("\n");
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

const newlineRE = /\r?\n/g;

function getMessages(runDirname: string): OTMessages {
  const messagesPath = resolve(outputPath, runDirname, "OT_Messages.txt");
  return new OTMessages(readFileSync(messagesPath, "UTF-8"));
}

function getTrainIDs(messages: OTMessages): string[] {
  return [
    ...new Set(
      messages
        .query()
        .map((v): string | null => v.trainID)
        .filter((trainID): trainID is string => trainID != null)
    ),
  ];
}

function getStuckTrainIDs(messages: OTMessages): string[] {
  return messages
    .query({
      message: "Terminated before End of Itinerary",
    })
    .map((v): string | null => v.trainID)
    .filter((trainID): trainID is string => trainID != null);
}

const dateRE = /^\/\/ Produced by OpenTrack: ([^\r\n]+)$/;
function getDate(runDirname: string): Date {
  const messagesPath = resolve(outputPath, runDirname, "OT_Messages.txt");
  if (!existsSync(messagesPath)) {
    console.warn(
      `Warning: ${messagesPath} doesn't exist, assuming it's in progress and returning current time.`
    );
    return new Date();
  }

  const [, dateString] =
    dateRE.exec(readFileSync(messagesPath, "UTF-8").split(newlineRE)[3]) ?? [];
  const date = new Date(dateString);

  if (Symbol.for("" + date) === Symbol.for("Invalid Date")) {
    throw new TypeError(`Error: found invalid date: ${dateString}.`);
  }

  return date;
}

function getStuck(runs: readonly Run[]): string[] {
  return getFailedRunSummary(
    "Stuck",
    runs,
    (run): readonly string[] => run.trainIDs,
    [...runs].filter((run): boolean => run.stuck > 0),
    (run): readonly string[] => run.stuckCourseIDs
  );
}

function getXX(runs: readonly Run[]): string[] {
  return getFailedRunSummary(
    "XX",
    runs,
    (run): readonly string[] => run.trainIDs,
    [...runs].filter((run): boolean => run.xx > 0),
    (run): readonly string[] => run.xxCourseIDs
  );
}

function getFailedRunSummary(
  title: string,
  allRuns: readonly Run[],
  reduceTotal: (run: Run) => readonly unknown[],
  failedRuns: readonly Run[],
  reduceFailed: (run: Run) => readonly unknown[]
): string[] {
  return [
    `${title} ${nOutOf(failedRuns.length, allRuns.length)}:`,
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
                .sort((a, b): number => a.runNumber - b.runNumber)
                .map(
                  (run): string =>
                    `#${run.runNumber} ${nOutOf(
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

function getRunNumbers(runs: readonly Run[]): number[] {
  return [...new Set(runs.map((run): number => run.runNumber))].sort(
    (a, b): number => a - b
  );
}

function getDateRange(
  runs: readonly Run[]
): { firstRunDate: Date; lastRunDate: Date } {
  const firstRunDate = new Date(
    runs
      .map((run): number => +run.date)
      .reduce<number>(
        (acc, date): number => (acc < date ? acc : date),
        Number.POSITIVE_INFINITY
      )
  );
  const lastRunDate = new Date(
    runs
      .map((run): number => +run.date)
      .reduce<number>(
        (acc, date): number => (acc > date ? acc : date),
        Number.NEGATIVE_INFINITY
      )
  );

  return { firstRunDate, lastRunDate };
}

function getNumberOfRuns(runs: readonly Run[]): number {
  return new Set<string>(runs.map((run): string => run.id)).size;
}

const REQUIRED_FILES = [
  "OT_Delay.delavg",
  "OT_Delay.delbegin",
  "OT_Delay.delend",
  "OT_Delay.dellaststop",
  "OT_Delay.delmax",
  "OT_Messages.txt",
  "OT_TimetableStatistics.txt",
];
function loadResults(): {
  runs: Run[];
} {
  const runs: Run[] = [];

  const allDirnames = readdirSync(outputPath, { withFileTypes: true })
    .filter((dirent): boolean => dirent.isDirectory())
    .map((dirent): string => dirent.name);
  const suffixes = new Set(
    allDirnames.map((dirname): string => getSuffix(dirname))
  );

  for (const suffix of suffixes) {
    const runDirnames = allDirnames.filter(
      (dirname): boolean => getSuffix(dirname) === suffix
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

      const messages = getMessages(runDirname);
      const trainIDs = getTrainIDs(messages);
      const stuckCourseIDs = getStuckTrainIDs(messages);
      const stuck = stuckCourseIDs.length;
      const date = getDate(runDirname);

      const [, runNumberString] = /^run-(\d+)-.*/.exec(runDirname);
      const runNumber = +runNumberString;

      const otTimettableStatistics = new OTTimetableStatistics(
        readFileSync(
          resolve(outputPath, runDirname, "OT_TimetableStatistics.txt"),
          "utf-8"
        )
      );
      const xxCourseIDs = [...otTimettableStatistics.getXXTrainIDs()];
      const xx = xxCourseIDs.length;
      const perCategoryDiffs = otTimettableStatistics.getGroupedBeginEndDelayDiffs(
        (course): [string, string] => ["total", course.split(" ", 1)[0]]
      );
      const perCourseDiffs = otTimettableStatistics.getBeginEndDelayDiffs();

      const run: Run = {
        date,
        delays: { perCategoryDiffs, perCourseDiffs },
        id: `${suffix}/${runNumber}`,
        module: suffix,
        runNumber,
        stuck,
        stuckCourseIDs,
        trainIDs,
        xx,
        xxCourseIDs,
      };

      runs.push(run);
    }
  }

  return { runs };
}

function csvHeader(text: string, module: string): string {
  return `${text} (${module})`;
}

function buildCSV(
  allRuns: readonly Run[],
  type: "perCategoryDiffs" | "perCourseDiffs"
): string {
  const modules = [...new Set(allRuns.map((run): string => run.module))].sort();
  const runNumbers = getRunNumbers(allRuns);

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
    "run",
    ...modules.flatMap((module): string[] => [
      "",
      ...diffCategories
        .filter((diffCategory): boolean => diffCategory !== "total")
        .map((diffCategory): string => csvHeader(diffCategory, module)),
      csvHeader("total", module),
    ]),
  ];
  const rows = runNumbers
    // Skip runs where all modules are not (yet) available.
    .filter(
      (runNumber): boolean =>
        new Set(
          allRuns
            .filter((run): boolean => run.runNumber === runNumber)
            .map((run): string => run.module)
        ).size === modules.length
    )
    // Turn runs into CSV rows.
    .map(
      (runNumber): Record<string, string> => {
        const runs = allRuns.filter(
          (run): boolean => run.runNumber === runNumber
        );

        return {
          run: "" + runNumber,
          ...modulesAndDiffCategories.reduce<Record<string, string>>(
            (acc, { diffCategory, module }): Record<string, string> => {
              const run = runs.find((run): boolean => run.module === module);
              if (run == null) {
                throw new Error(`Can't find for "${module}" #${runNumber}.`);
              }

              const delay = run.delays[type].get(diffCategory);
              if (delay == null) {
                throw new Error(
                  `Can't find "${diffCategory}" delays in "${module}" #${runNumber}.`
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

    const { firstRunDate, lastRunDate } = getDateRange(allRuns);

    const numberOfRuns = getNumberOfRuns(allRuns);
    const stuck = getStuck(allRuns).join("\n");
    const xx = getXX(allRuns).join("\n");

    // Note: All the times are finish times. The +1, -1 logic bellow
    // extrapolates start times based on finish times and the average difference
    // between them.
    const totalDuration = formatDistanceStrict(
      firstRunDate,
      new Date(
        +firstRunDate +
          Math.round(
            (+lastRunDate - +firstRunDate) * ((numberOfRuns + 1) / numberOfRuns)
          )
      )
    );
    const avgRunDuration = formatDistanceStrict(
      firstRunDate,
      new Date(
        numberOfRuns > 1
          ? +firstRunDate +
            Math.round((+lastRunDate - +firstRunDate) / (numberOfRuns - 1))
          : +firstRunDate
      )
    );

    lines.push("First run: " + firstRunDate);
    lines.push("Last run: " + lastRunDate);
    lines.push("Number of runs: " + numberOfRuns);
    lines.push("Duration: " + totalDuration);
    lines.push("Avg run duration: " + avgRunDuration);
    lines.push("Never reached: " + xx);
    lines.push("Stuck: " + stuck);
  }

  for (const type of ["perCategoryDiffs", "perCourseDiffs"] as const) {
    const csv = buildCSV(allRuns, type);
    writeFileSync(
      resolve(outputPath, `${basename(outputPath)}.delays.${type}.csv`),
      csv
    );
  }

  return lines.join("\n");
}
