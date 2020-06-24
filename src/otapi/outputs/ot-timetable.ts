import { CSV } from "./csv";

const HEADERS_IN_FILE_ORDER = [
  "run",
  "scenario",
  "course",
  "station",
  "arrivalPlannedHHMMSS",
  "arrivalPlannedS",
  "departurePlannedHHMMSS",
  "departurePlannedS",
  "arrivalActualHHMMSS",
  "arrivalActualS",
  "departureActualHHMMSS",
  "departureActualS",
  "arrivalDiffHHMMSS",
  "arrivalDiffS",
  "departureDiffHHMMSS",
  "departureDiffS",
] as const;
type HeaderKey = typeof HEADERS_IN_FILE_ORDER[number];

const FIELD_DELIMITER = "\t";
const HEADER_ROWS = 2;

// TODO

export class OTTimetable extends CSV<HeaderKey> {
  public constructor(txt: string) {
    super(txt, {
      fieldDelimiter: FIELD_DELIMITER,
      headerRows: HEADER_ROWS,
      keys: HEADERS_IN_FILE_ORDER,
    });
  }
}
