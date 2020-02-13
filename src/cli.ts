import yargs from "yargs";

const y = yargs
  .strict(true)
  .usage("dp [options]")
  .hide("version")
  .config()
  .help()

  .option("overtaking-modules", {
    array: true,
    describe: "Decision modules for overtaking",
    required: false,
    type: "string"
  })
  .option("overtaking-default-module", {
    default: "max-speed",
    describe:
      "The decision module that will be used unless specified otherwise",
    required: false,
    type: "string"
  })

  .option("ot-binary", {
    describe: "!",
    required: true,
    type: "string"
  })
  .option("ot-export-courses", {
    describe: "!",
    required: true,
    type: "string"
  })
  .option("ot-export-infrastructure", {
    describe: "!",
    required: true,
    type: "string"
  })
  .option("ot-export-rolling-stock", {
    describe: "!",
    required: true,
    type: "string"
  })
  .option("ot-export-timetables", {
    describe: "!",
    required: true,
    type: "string"
  })
  .option("ot-log", {
    describe: "!",
    required: true,
    type: "string"
  })
  .option("ot-runfile", {
    describe: "!",
    required: true,
    type: "string"
  })

  .option("log-ot-responses", {
    default: false,
    describe: "If enabled OpenTrack responses will be logged to the console.",
    type: "boolean"
  })
  .option("randomize-ports", {
    default: false,
    describe: "Put random pair of ports into the runfile.",
    type: "boolean"
  })
  .option("manage-ot", {
    default: false,
    describe: "If enabled OpenTrack will be started and terminated.",
    type: "boolean"
  });

export const args: ReturnType<typeof y["parse"]> = y
  .parserConfiguration({ "camel-case-expansion": false })
  .parse();
