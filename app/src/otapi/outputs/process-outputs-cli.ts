/* eslint-disable no-console */

import yargs from "yargs";
import { readFileSync } from "fs";

import { GroupingConfig, groupingConfigSerializer } from "./grouping-config";
import { processOutputs } from "./process-outputs";

export function processOutputsCLI(): void {
  const y = yargs
    .strict(true)
    .usage("dp-outputs [options]")
    .hide("version")
    .config()
    .help()

    .option("output-path", {
      describe: "The output path from OpenTrack.",
      required: true,
      type: "string",
    })
    .option("grouping-config", {
      default: null,
      describe: "Train grouping configuration.",
      required: false,
      type: "string",
    })
    .option("skip-xx", {
      default: true,
      describe:
        "Skip scenarios where some trains didn't reach some of their stations.",
      required: false,
      type: "boolean",
    })
    .option("require-otsimcors", {
      default: 0,
      describe:
        "Skip scenario unless it has this many otsimcor files for each module.",
      required: false,
      type: "number",
    })
    .option("ignore-scenarios", {
      default: false,
      describe:
        "If true different scenarios will be mixed on the same row instead of skipped. " +
        "E.g. if there is only scenario 1 of first module and 2 of second module the first row will contain both.",
      required: false,
      type: "boolean",
    })

    .parserConfiguration({ "camel-case-expansion": false })
    .parse();

  const groupingConfigPath = y["grouping-config"];
  const ignoreScenarios = y["ignore-scenarios"];
  const outputPath = y["output-path"];
  const requireOtsimcor = y["require-otsimcors"];
  const skipXX = y["skip-xx"];

  const groupingConfig = groupingConfigPath
    ? groupingConfigSerializer.parse(readFileSync(groupingConfigPath, "utf8"))
    : new GroupingConfig();
  if (groupingConfig == null) {
    throw new TypeError("Failed to parse grouping config.");
  }

  const getGroupsForTrain = (trainID: string): string[] => {
    const groups: string[] = [...groupingConfig.groupsForAllTrains];

    for (const rule of groupingConfig.rules) {
      if (
        rule.trainIDs.has(trainID) ||
        rule.trainIDREs.some((trainIDRE): boolean => trainIDRE.test(trainID))
      ) {
        groups.push(...rule.groups);
      }
    }

    return groups;
  };

  console.time("PO");
  process.stdout.write(
    processOutputs({
      getGroupsForTrain,
      ignoreScenarios,
      outputPath,
      requireOtsimcor,
      skipXX,
    })
  );
  console.timeEnd("PO");
}
