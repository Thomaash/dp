import Yargs from "yargs/yargs";
import { ItineraryArgs } from "./types";

const y = Yargs()
  .parserConfiguration({ "camel-case-expansion": false })
  .strict(true)

  .option("overtaking", {
    default: false,
    describe:
      "Whether this itinerary should be considered an overtaking opportunity or not.",
    required: false,
    type: "boolean",
  })
  .option("max-waiting", {
    default: Number.NaN,
    describe: "How many trains can wait to be overtaking.",
    required: false,
    type: "number",
  });

export function parseItineraryArgs(s: string): ItineraryArgs {
  const args = y.parse(s);

  return {
    maxWaiting: args["max-waiting"],
    overtaking: args["overtaking"],
  };
}
