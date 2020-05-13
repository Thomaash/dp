#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { formatDistanceStrict } = require("date-fns");

const root = process.argv[2];
const delayType = process.argv[3] || "end";

function getSuffix(dirname) {
  return dirname.replace(/^run-\d+-/, "");
}

function formatIntoColumns(...columns) {
  const columnLines = columns.map((columnText) => columnText.split("\n"));
  const width = columnLines.reduce((acc, lines) => {
    const length = lines.reduce((acc, line) => Math.max(acc, line.length), 0);

    return Math.max(acc, length);
  }, 0);
  const height = columnLines.reduce((acc, lines) => {
    return Math.max(acc, lines.length);
  }, 0);

  const fixedSizeColumnLines = columnLines.map((lines) => {
    const fixedSizeLines = lines.slice();
    while (fixedSizeLines.length < height) {
      fixedSizeLines.push("");
    }

    return fixedSizeLines.map((line) => line.padEnd(width, " "));
  });

  const lines = [];
  for (let i = 0; i < height; ++i) {
    lines.push(fixedSizeColumnLines.map((lines) => lines[i]).join("    "));
  }
  return lines.join("\n");
}

const newlineRE = /\r?\n/g;

const stuckRE = /^WARNING\s.*: Terminated before End of Itinerary\s/;
function countStuckTrains(runDirname) {
  const messagesPath = path.join(root, runDirname, "OT_Messages.txt");
  if (!fs.existsSync(messagesPath)) {
    console.warn(`Warning: ${messagesPath} doesn't exist.`);
    return 0;
  }

  return fs
    .readFileSync(messagesPath, "UTF-8")
    .split(newlineRE)
    .filter((line) => stuckRE.test(line)).length;
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
        run,
        trainID,
        delaySeconds: +delaySeconds,
        stationID,
        time,
      };
    });
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

      const stuck = countStuckTrains(runDirname);
      const date = getDate(runDirname);

      const [, runNumberString] = /^run-(\d+)-.*/.exec(runDirname);
      const runNumber = +runNumberString;

      const run = {
        date,
        id: `${suffix}/${runNumber}`,
        module: suffix,
        runNumber,
        stuck,
      };

      run.delays = fetchDelX(delayType, run, runDirname);

      results.push(...run.delays);
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
  const results = loadResults();
  console.info();

  const modules = [
    ...new Set(results.map((result) => result.run.module)),
  ].sort();

  const moduleTexts = [];
  for (const module of modules) {
    const moduleLines = [];

    moduleLines.push(`Module: ${module}`);

    const moduleResults = results.filter(
      (result) => result.run.module === module
    );
    const trainTypes = [
      ...new Set(moduleResults.map((result) => result.trainID.split(" ")[0])),
    ].sort();

    const runs = new Set(moduleResults.map((result) => result.run));
    moduleLines.push(`  Runs: ${runs.size}`);

    const stuck = [...runs].filter((run) => run.stuck > 0);
    if (stuck.length > 0) {
      moduleLines.push(
        `  Stuck runs: ${stuck.length} (${Math.round(
          (stuck.length / runs.size) * 100
        )} %); ${stuck
          .sort((a, b) => a.runNumber - b.runNumber)
          .map((run) => "#" + run.runNumber)
          .join(", ")}`
      );
    }

    moduleLines.push("  Delays:");
    moduleLines.push(
      `    Total: ${computeAverageDelay(moduleResults)} seconds`
    );
    for (const trainType of trainTypes) {
      moduleLines.push(
        `    ${trainType}: ${computeAverageDelay(
          moduleResults.filter((result) =>
            result.trainID.startsWith(trainType + " ")
          )
        )} seconds`
      );
    }

    moduleLines.push();

    moduleTexts.push(moduleLines.join("\n"));
  }

  console.info(formatIntoColumns(...moduleTexts) + "\n\n");

  if (results.length >= 2) {
    const firstRunDate = results
      .map((result) => result.run.date)
      .reduce(
        (acc, date) => (acc < date ? acc : date),
        Number.POSITIVE_INFINITY
      );
    const lastRunDate = results
      .map((result) => result.run.date)
      .reduce(
        (acc, date) => (acc > date ? acc : date),
        Number.NEGATIVE_INFINITY
      );

    const numberOfRuns = new Set(results.map((result) => result.run.id)).size;

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
    console.info("Duration:        ", totalDuration);
    console.info("Avg run duration:", avgRunDuration);
  }
})();
