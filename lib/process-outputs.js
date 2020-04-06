#!/usr/bin/env node

const path = require("path");
const fs = require("fs");

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

function loadResults() {
  const results = [];

  const allDirnames = fs.readdirSync(root);
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

      const [, runNumberString] = /^run-(\d+)-.*/.exec(runDirname);
      const runNumber = +runNumberString;

      const run = { stuck, runNumber, module: suffix };

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
})();
