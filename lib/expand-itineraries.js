#!/usr/bin/env node

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
  .option("rules", {
    describe:
      "JSON file mapping main itineraries to other itineraries (`{ additions: [string[], string[]] }`).",
    required: true,
    type: "string"
  });

const args = y.parse();

(async () => {
  const xmlParser = new xml2js.Parser({
    preserveChildrenOrder: true
  });

  const rules = JSON.parse(readFileSync(args.rules, "UTF-8"));

  const coursesFile = readFileSync(args.trafitCourses, "UTF-8");
  const courses = await xmlParser.parseStringPromise(coursesFile);

  for (const course of courses["trafIT"]["courses"][0]["course"]) {
    const mainItinerary = course["itinerary"][0];
    const mainItineraryName = mainItinerary.$.name;

    const additions = [
      ...new Set(
        rules.additions
          .filter(([keys]) => keys.some(key => key === mainItineraryName))
          .flatMap(([, additions]) => additions)
      )
    ];

    console.log(
      `Adding ${additions.length} itineraries to ${course.$.courseID}.`
    );

    course.itinerary.push(
      ...additions.map((name, i) => ({
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
