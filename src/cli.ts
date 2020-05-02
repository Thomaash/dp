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
    type: "string",
  })
  .option("overtaking-default-module", {
    default: "timetable-guess",
    describe:
      "The decision module that will be used unless specified otherwise",
    required: false,
    type: "string",
  })

  .option("ot-binary", {
    describe: "OpenTrack executable file.",
    required: true,
    type: "string",
  })
  .option("ot-host", {
    describe:
      "OpenTrack host (e.g. IP or domain of the server OpenTrack runs on).",
    required: true,
    type: "string",
  })
  .option("ot-export-courses", {
    describe:
      "OpenTrack -> Functions -> Exchange Timetable Data -> Export Courses (trafIT-Format).",
    required: true,
    type: "string",
  })
  .option("ot-export-infrastructure", {
    describe:
      "OpenTrack -> Functions -> Exchange Infrastructure Data -> Export Infrastructure Data (trafIT-Format).",
    required: true,
    type: "string",
  })
  .option("ot-export-rolling-stock", {
    describe:
      "OpenTrack -> Functions -> Exchange Rolling Stock Data -> Export Rolling Stock (railML-Format) Version 2.2.",
    required: true,
    type: "string",
  })
  .option("ot-export-timetable", {
    describe:
      "OpenTrack -> Functions -> Exchange Timetable Data -> Export Timetable (railML-Format) Version 2.2.",
    required: true,
    type: "string",
  })
  .option("ot-log", {
    describe:
      "The file into which the stdout and stderr from OpenTrack will be written.",
    required: true,
    type: "string",
  })
  .option("communication-log", {
    describe:
      "The file into which the communcation with OpenTrack will be written.",
    required: false,
    type: "string",
    default: null,
  })
  .option("ot-runfile", {
    describe:
      "The location of the runfile that will be used by both this app and OpenTrack.",
    required: true,
    type: "string",
  })

  .option("log-file", {
    describe: "The file into which the log (stdout/stderr) will be written.",
    required: false,
    type: "string",
    default: null,
  })
  .option("log-ot-responses", {
    default: false,
    describe: "If enabled OpenTrack responses will be logged to the console.",
    type: "boolean",
  })
  .option("randomize-ports", {
    default: false,
    describe: "Put random pair of ports into the runfile.",
    type: "boolean",
  })
  .option("manage-ot", {
    default: false,
    describe: "If enabled OpenTrack will be started and terminated.",
    type: "boolean",
  })
  .option("runs", {
    default: -1,
    describe:
      "If enabled n runs will be performed (only works with --manage-ot), if disabled (-1) the runfile will be respected.",
    type: "number",
  })
  .option("control-runs", {
    default: false,
    describe:
      "If enabled runs will be performed with and without decision module (only works with --manage-ot).",
    type: "boolean",
  });

export const args: ReturnType<typeof y["parse"]> = y
  .parserConfiguration({ "camel-case-expansion": false })
  .parse();
