import Yargs from "yargs/yargs";

const y = Yargs()
  .parserConfiguration({ "camel-case-expansion": false })
  .strict(true)

  .option("overtaking", {
    default: false,
    describe:
      "Whether this itinerary should be considered an overtaking opportunity or not.",
    required: false,
    type: "boolean"
  });

export const parseItineraryArgs: typeof y["parse"] = y.parse.bind(y);
