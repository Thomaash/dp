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
  .option("ot-runfile", {
    describe:
      "The location of the runfile that will be used by both this app and OpenTrack.",
    required: true,
    type: "string",
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
  });

export const args: ReturnType<typeof y["parse"]> = y
  .parserConfiguration({ "camel-case-expansion": false })
  .parse();
