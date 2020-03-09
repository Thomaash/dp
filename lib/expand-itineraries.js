"use strict";

const xml2js = require("xml2js");
const { readFileSync, writeFileSync } = require("fs");

const yargs = require("yargs");

const y = yargs
  .strict(true)
  .usage("expand-itineraries [options]")
  .hide("version")
  .config()
  .help()

  .option("trafit-courses", {
    describe: "Courses in the trafIT XML format.",
    required: true,
    type: "string"
  })
  .option("replacements", {
    describe:
      "JSON file mapping main itineraries to other itineraries (`Record<string, string[]>`).",
    required: true,
    type: "string"
  });

const args = y.parse();

(async () => {
  const xmlParser = new xml2js.Parser({
    preserveChildrenOrder: true
  });

  const config = JSON.parse(readFileSync(args.replacements, "UTF-8"));

  const coursesFile = readFileSync(args.trafitCourses, "UTF-8");
  const courses = await xmlParser.parseStringPromise(coursesFile);

  for (const course of courses["trafIT"]["courses"][0]["course"]) {
    const mainItinerary = course["itinerary"][0];
    const mainItineraryName = mainItinerary.$.name;

    const replacements = config[mainItineraryName];
    if (replacements == null) {
      console.log(`No replacements for ${mainItineraryName}.`);
      continue;
    } else {
      console.log(`Replacing ${mainItineraryName}.`);
    }

    course.itinerary.splice(
      1,
      Number.POSITIVE_INFINITY,
      ...config[mainItineraryName].map((name, i) => ({
        $: {
          name,
          priority: i + 2
        }
      }))
    );
  }

  const builder = new xml2js.Builder();
  const xml = [
    ...coursesFile.split(/\r?\n/).slice(0, 2),
    ...builder
      .buildObject(courses)
      .split("\n")
      .slice(1)
  ].join("\n");

  writeFileSync(args["trafit-courses"] + ".fixed.xml", xml);
})();
