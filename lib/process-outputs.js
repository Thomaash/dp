#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { formatDistanceStrict } = require("date-fns");

const root = process.argv[2];
const delayType = process.argv[3];

const types = delayType?.split(",") ?? [
  "begin",
  "laststop",
  "max",
  "end",
  "avg",
];

class OTMessages {
  constructor(text) {
    this._messages = this._parseMessages(text);
  }

  _parseMessages(text) {
    return text
      .split("\n")
      .filter((line) => !line.startsWith("//") && line !== "")
      .map((line) =>
        line
          .split("\t")
          .map((cell) =>
            typeof cell === "string" && cell !== "" ? cell.trim() : undefined
          )
      )
      .map((cells) => ({
        level: cells[0] ?? null,
        simTime: cells[1] ?? null,
        trainID: cells[2] ?? null,
        message: cells[3] ?? null,
        document: cells[4] ?? null,
      }))
      .map((value) => {
        if (value.document != null) {
          if (
            !(value.document.startsWith("(") && value.document.endsWith(")"))
          ) {
            throw new Error("This should never happen.");
          }

          return {
            ...value,
            document: value.document.slice(1, -1),
          };
        } else {
          return value;
        }
      })
      .map((value) => {
        if (value.trainID != null) {
          if (!value.message.startsWith("Course " + value.trainID + ": ")) {
            throw new Error("This should never happen.");
          }

          return {
            ...value,
            message: value.message.split(": ", 2)[1],
          };
        } else {
          return value;
        }
      });
  }

  query({
    level = null,
    simTime = null,
    trainID = null,
    message = null,
    document = null,
  } = {}) {
    return this._messages
      .filter(
        (value) =>
          (level == null || value.level === level) &&
          (simTime == null || value.simTime === simTime) &&
          (trainID == null || value.trainID === trainID) &&
          (message == null || value.message === message) &&
          (document == null || value.document === document)
      )
      .map((value) => ({ ...value }));
  }
}

function nOutOf(n, total) {
  return `${n}/${total} (${Math.round((n / total) * 100)}%)`;
}

function getSuffix(dirname) {
  return dirname.replace(/^run-\d+-/, "");
}

function formatIntoColumns(...columns) {
  const columnLines = columns.map((columnText) => columnText.split("\n"));
  const widths = columnLines.map((lines) =>
    lines.reduce((acc, line) => Math.max(acc, line.length), 0)
  );
  const height = columnLines.reduce((acc, lines) => {
    return Math.max(acc, lines.length);
  }, 0);

  const fixedSizeColumnLines = columnLines.map((lines, i) => {
    const fixedSizeLines = lines.slice();
    while (fixedSizeLines.length < height) {
      fixedSizeLines.push("");
    }

    return fixedSizeLines.map((line) => line.padEnd(widths[i], " "));
  });

  const lines = [];
  for (let i = 0; i < height; ++i) {
    lines.push(fixedSizeColumnLines.map((lines) => lines[i]).join("      "));
  }
  return lines.join("\n");
}

function toCSV(rows, delimiter = ",", keys = Object.keys(rows[0])) {
  const lines = [keys.join(delimiter)];

  for (const row of rows) {
    lines.push(keys.map((key) => row[key] ?? "").join(delimiter));
  }

  return lines.join("\n");
}

const newlineRE = /\r?\n/g;

function getMessages(runDirname) {
  const messagesPath = path.join(root, runDirname, "OT_Messages.txt");
  if (!fs.existsSync(messagesPath)) {
    console.warn(`Warning: ${messagesPath} doesn't exist.`);
    return 0;
  }

  return new OTMessages(fs.readFileSync(messagesPath, "UTF-8"));
}

function getTrainIDs(messages) {
  return [
    ...new Set(
      messages
        .query()
        .map((v) => v.trainID)
        .filter((trainID) => trainID != null)
    ),
  ];
}

function getStuckTrainIDs(messages) {
  return messages
    .query({
      message: "Terminated before End of Itinerary",
    })
    .map((v) => v.trainID);
}

const dateRE = /^\/\/ Produced by OpenTrack: ([^\r\n]+)$/;
function getDate(runDirname) {
  const messagesPath = path.join(root, runDirname, "OT_Messages.txt");
  if (!fs.existsSync(messagesPath)) {
    console.warn(
      `Warning: ${messagesPath} doesn't exist, assuming it's in progress and returning current time.`
    );
    return new Date();
  }

  const [, dateString] = dateRE.exec(
    fs.readFileSync(messagesPath, "UTF-8").split(newlineRE)[3]
  );

  return new Date(dateString);
}

function fetchDelX(type, run, runDirname) {
  const delXPath = path.join(root, runDirname, "OT_Delay.del" + type);
  if (!fs.existsSync(delXPath)) {
    console.warn(`Warning: ${delXPath} doesn't exist.`);
    return [];
  }

  return fs
    .readFileSync(delXPath, "UTF-8")
    .split(newlineRE)
    .filter((line) => line !== "" && !line.startsWith("//"))
    .map((line) => {
      const [trainID, delaySeconds, stationID, time] = line.split("\t");
      return {
        delaySeconds: +delaySeconds,
        run,
        stationID,
        time,
        trainID,
        type,
      };
    });
}

function getStuck(results) {
  const runs = new Set(results.map((result) => result.run));
  const stuck = [...runs].filter((run) => run.stuck > 0);
  const modules = new Set([...stuck.map((run) => run.module)]);

  return {
    length: stuck.length,
    shortText: `${nOutOf(stuck.length, runs.size)}; ${stuck
      .sort((a, b) => a.runNumber - b.runNumber)
      .map(
        (run) =>
          "#" + run.runNumber + (modules.size > 1 ? ` (${run.module})` : "")
      )
      .join(", ")}`,
    detailedText: `${nOutOf(stuck.length, runs.size)}\n${stuck
      .sort((a, b) => a.runNumber - b.runNumber)
      .map(
        (run) =>
          `  #${run.runNumber} ${run.module}, ${nOutOf(
            run.stuckCourseIDs.length,
            run.trainIDs.length
          )} trains): ${run.stuckCourseIDs.join(", ")}`
      )
      .join("\n")}`,
  };
}

function getRunNumbers(results) {
  return [...new Set(results.map((result) => result.run.runNumber))].sort(
    (a, b) => a - b
  );
}

function getTrainTypes(results) {
  return [
    ...new Set(results.map((result) => result.trainID.split(" ")[0])),
  ].sort();
}

function singleModuleToString(module, type, allModuleResults) {
  const moduleLines = [];
  moduleLines.push(`Module: ${module}`);

  const singleTypeResults = allModuleResults.filter(
    (result) => result.type === type
  );

  const trainTypes = getTrainTypes(singleTypeResults);

  const runs = new Set(singleTypeResults.map((result) => result.run));
  moduleLines.push(`  Runs: ${runs.size}`);

  moduleLines.push("  Delays:");
  moduleLines.push(
    `    Total: ${computeAverageDelay(singleTypeResults)} seconds`
  );
  for (const trainType of trainTypes) {
    moduleLines.push(
      `    ${trainType}: ${computeAverageDelay(
        singleTypeResults.filter((result) =>
          result.trainID.startsWith(trainType + " ")
        )
      )} seconds`
    );
  }

  moduleLines.push();

  return moduleLines.join("\n");
}

function loadResults() {
  const results = [];

  const allDirnames = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  const suffixes = new Set(allDirnames.map((dirname) => getSuffix(dirname)));

  for (const suffix of suffixes) {
    const runDirnames = allDirnames.filter(
      (dirname) => getSuffix(dirname) === suffix
    );
    for (const runDirname of runDirnames) {
      const delendPath = path.join(root, runDirname, "OT_Delay.delend");
      if (!fs.existsSync(delendPath)) {
        console.warn(`Warning: ${delendPath} doesn't exist.`);
        continue;
      }

      const messages = getMessages(runDirname);
      const trainIDs = getTrainIDs(messages);
      const stuckCourseIDs = getStuckTrainIDs(messages);
      const stuck = stuckCourseIDs.length;
      const date = getDate(runDirname);

      const [, runNumberString] = /^run-(\d+)-.*/.exec(runDirname);
      const runNumber = +runNumberString;

      const run = {
        trainIDs,
        date,
        delays: {},
        id: `${suffix}/${runNumber}`,
        module: suffix,
        runNumber,
        stuck,
        stuckCourseIDs,
      };

      for (const type of types) {
        run.delays[type] = fetchDelX(type, run, runDirname);

        results.push(...run.delays[type]);
      }
    }
  }

  return results;
}

function computeAverageDelay(results) {
  return (
    results.reduce((acc, result) => acc + Math.max(0, result.delaySeconds), 0) /
    results.length
  );
}

(async () => {
  const allResults = loadResults();
  console.info();

  const resultsOfModules = [
    ...new Set(allResults.map((result) => result.run.module)),
  ].sort();

  for (const type of types) {
    console.info(`==> Delays ${type}\n`);

    const moduleTexts = [];
    for (const results of resultsOfModules) {
      const moduleResults = allResults.filter(
        (result) => result.run.module === results
      );

      moduleTexts.push(singleModuleToString(results, type, moduleResults));
    }

    console.info(formatIntoColumns(...moduleTexts) + "\n\n");
  }

  if (allResults.length >= 2) {
    console.info(`==> Other\n`);

    const firstRunDate = allResults
      .map((result) => result.run.date)
      .reduce(
        (acc, date) => (acc < date ? acc : date),
        Number.POSITIVE_INFINITY
      );
    const lastRunDate = allResults
      .map((result) => result.run.date)
      .reduce(
        (acc, date) => (acc > date ? acc : date),
        Number.NEGATIVE_INFINITY
      );

    const numberOfRuns = new Set(allResults.map((result) => result.run.id))
      .size;
    const stuck = getStuck(allResults).detailedText;

    // Note: All the times are finish times. The +1, -1 logic bellow
    // extrapolates start times based on finish times and the average difference
    // between them.
    const totalDuration = formatDistanceStrict(
      firstRunDate,
      new Date(
        +firstRunDate +
          Math.round(
            (lastRunDate - firstRunDate) * ((numberOfRuns + 1) / numberOfRuns)
          )
      )
    );
    const avgRunDuration = formatDistanceStrict(
      firstRunDate,
      new Date(
        +firstRunDate +
          Math.round((lastRunDate - firstRunDate) / (numberOfRuns - 1))
      )
    );

    console.info("First run:       ", firstRunDate);
    console.info("Last run:        ", lastRunDate);
    console.info("Number of runs:  ", numberOfRuns);
    console.info("Stuck:           ", stuck);
    console.info("Duration:        ", totalDuration);
    console.info("Avg run duration:", avgRunDuration);
  }

  const trainTypes = getTrainTypes(allResults);
  const modules = resultsOfModules;
  const modulesAndTrainTypes = modules.flatMap((module) =>
    trainTypes.map((trainType) => ({ module, trainType }))
  );
  const runNumbers = getRunNumbers(allResults);

  function csvHeader(text, module) {
    return `${text} (${module})`;
  }

  for (const type of types) {
    const typeResults = allResults.filter((result) => result.type === type);

    const keys = [
      "run",
      ...modules.flatMap((module) => [
        "",
        ...trainTypes.map((trainType) => csvHeader(trainType, module)),
        csvHeader("total", module),
      ]),
    ];
    const rows = runNumbers.map((runNumber) => {
      const runResults = typeResults.filter(
        (result) => result.run.runNumber === runNumber
      );

      return {
        run: runNumber,
        ...modules.reduce((acc, module) => {
          const results = runResults.filter(
            (result) => result.run.module === module
          );

          acc[csvHeader("total", module)] = computeAverageDelay(results);

          return acc;
        }, {}),
        ...modulesAndTrainTypes.reduce((acc, { module, trainType }) => {
          const results = runResults.filter(
            (result) =>
              result.run.module === module &&
              result.trainID.startsWith(trainType + " ")
          );

          acc[csvHeader(trainType, module)] = computeAverageDelay(results);

          return acc;
        }, {}),
      };
    });

    const csv = toCSV(rows, ",", keys);
    fs.writeFileSync(path.resolve(root, `delays.${type}.csv`), csv);
  }
})();
