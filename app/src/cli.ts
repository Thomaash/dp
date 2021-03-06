import yargs from "yargs";

const y = yargs
  .strict(true)
  .usage("dp [options]")
  .hide("version")
  .config()
  .help()

  .option("overtaking-module", {
    array: true,
    default: ["do-nothing"],
    describe:
      "Decision module for overtaking (can be repeated). " +
      "Format: `name?args` or `path-with-slash?args`. " +
      'Where args is a JSON object (e.g. `{ "arg-name": "arg-value" }`).',
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
  .option("ot-export-infrastructure-otml", {
    describe:
      "OpenTrack -> Functions -> Exchange Infrastructure Data -> Export Infrastructure Data (OTML-Format).",
    required: true,
    type: "string",
  })
  .option("ot-export-infrastructure-trafit", {
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
      "The file into which the communication with OpenTrack will be written.",
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
  .option("max-simultaneous-requests", {
    default: 1,
    describe: "How many requests to send in parallel.",
    type: "number",
  })
  .option("max-retries", {
    default: 5,
    describe: "How many times to retry a request before declaring failure.",
    type: "number",
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
  .option("delay-scenario-first", {
    default: -1,
    describe: "The delay scenario to start with (inclusive).",
    type: "number",
  })
  .option("delay-scenario-last", {
    default: -1,
    describe: "The delay scenario to end with (inclusive).",
    type: "number",
  })
  .option("stop-file", {
    default: null,
    describe:
      "If this file exists the simulation will gracefully stop after finishing all runs with the already started delay scenario. Note that the file will be deleted if it exists before the simulation is started.",
    type: "string",
  })
  .option("pause-after-each-run", {
    default: false,
    describe:
      "If enabled pauses the simulation after each run (e.g. for manual inspection).",
    type: "boolean",
  })
  .option("pause-before-each-run", {
    default: false,
    describe:
      "If enabled pauses the simulation before each run (e.g. for manual inspection).",
    type: "boolean",
  })
  .option("pause-with-stuck-trains", {
    default: false,
    describe:
      "If enabled pauses the simulation and waits for resume when there are stuck trains at the end of a run.",
    type: "boolean",
  })

  .option("test-connection-serial", {
    default: 0,
    describe:
      "Send n requests in series to test the connection (sends requests one by one regardless of max-simultaneous-requests).",
    hidden: true,
    type: "number",
  })
  .option("test-connection-parallel", {
    default: 0,
    describe:
      "Send n requests in parrallel to test the connection (respects max-simultaneous-requests, even if that means sending them in series).",
    hidden: true,
    type: "number",
  });

export const args: ReturnType<typeof y["parse"]> = y
  .parserConfiguration({ "camel-case-expansion": false })
  .parse();
