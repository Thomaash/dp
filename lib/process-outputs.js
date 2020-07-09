#!/usr/bin/env node

const { processOutputs } = require("../dist/otapi");
const yargs = require("yargs");

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

const ignoreScenarios = y["ignore-scenarios"];
const outputPath = y["output-path"];
const requireOtsimcor = y["require-otsimcors"];

process.stdout.write(
  processOutputs({ ignoreScenarios, outputPath, requireOtsimcor })
);
