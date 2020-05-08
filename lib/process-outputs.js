#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { formatDistanceStrict } = require("date-fns");

const root = process.argv[2];

function getSuffix(dirname) {
  return dirname.replace(/^run-\d+-/, "");
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

      const delaysEnd = fs
        .readFileSync(delendPath, "UTF-8")
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

      run.delaysEnd = delaysEnd;

      results.push(...delaysEnd);
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

  for (const module of modules) {
    console.info(`Module: ${module}`);

    const moduleResults = results.filter(
      (result) => result.run.module === module
    );
    const trainTypes = [
      ...new Set(moduleResults.map((result) => result.trainID.split(" ")[0])),
    ].sort();

    const runs = new Set(moduleResults.map((result) => result.run));
    console.info(`  Runs: ${runs.size}`);

    const stuck = [...runs].filter((run) => run.stuck > 0);
    if (stuck.length > 0) {
      console.warn(
        `  Stuck runs: ${stuck.length} (${Math.round(
          (stuck.length / runs.size) * 100
        )} %); ${stuck
          .sort((a, b) => a.runNumber - b.runNumber)
          .map((run) => "#" + run.runNumber)
          .join(", ")}`
      );
    }

    console.info("  Delays:");
    console.info(`    Total: ${computeAverageDelay(moduleResults)} seconds`);
    for (const trainType of trainTypes) {
      console.info(
        `    ${trainType}: ${computeAverageDelay(
          moduleResults.filter((result) =>
            result.trainID.startsWith(trainType + " ")
          )
        )} seconds`
      );
    }

    console.info();
  }

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
    const totalDuration = formatDistanceStrict(firstRunDate, lastRunDate);
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
