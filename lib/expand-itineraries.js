#!/usr/bin/env node

/* eslint-disable no-console */

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
    type: "string",
  })
  .option("rules", {
    describe:
      "JSON file mapping main itineraries to other itineraries (`{ additions: [string[], string[]] }`).",
    required: true,
    type: "string",
  });

const args = y.parse();

(async () => {
  const xmlParser = new xml2js.Parser({
    preserveChildrenOrder: true,
  });

  const rules = JSON.parse(readFileSync(args.rules, "UTF-8"));

  const deleteREs = rules.deletions.map((str) => new RegExp(str));
  function shouldBeDeleted(itinerary) {
    return deleteREs.some((re) => re.test(itinerary.$.name));
  }

  const coursesFile = readFileSync(args.trafitCourses, "UTF-8");
  const courses = await xmlParser.parseStringPromise(coursesFile);

  for (const course of courses["trafIT"]["courses"][0]["course"]) {
    const itineraryAfterDeletion = course.itinerary.filter(
      (itinerary) => !shouldBeDeleted(itinerary)
    );
    if (itineraryAfterDeletion.length !== course.itinerary.length) {
      console.log(
        `Deleting ${
          course.itinerary.length - itineraryAfterDeletion.length
        } out of ${course.itinerary.length} itineraries from ${
          course.$.courseID
        }.`
      );
      course.itinerary = itineraryAfterDeletion;
    }

    const mainItinerary = course["itinerary"][0];
    const mainItineraryName = mainItinerary.$.name;

    const additions = [
      ...new Set(
        rules.additions
          .filter(([keys]) =>
            keys.some((key) => new RegExp(key).test(mainItineraryName))
          )
          .flatMap(([, additions]) => additions)
      ),
    ];
    if (additions.length > 0) {
      console.log(
        `Adding ${additions.length} itineraries to ${course.$.courseID}.`
      );
      course.itinerary.push(
        ...additions.map((name, i) => ({
          $: {
            name,
            priority: i + 1 + course.itinerary.length,
          },
        }))
      );
    }
  }

  const builder = new xml2js.Builder();
  const xml = [
    ...coursesFile.split(/\r?\n/).slice(0, 2),
    ...builder.buildObject(courses).split("\n").slice(1),
  ].join("\n");

  writeFileSync(args["trafit-courses"] + ".fixed.xml", xml);
})();
