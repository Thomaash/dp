import { CSVQuery, CSV } from "./csv";
import { MapSet } from "../../util";

const HEADERS_IN_FILE_ORDER = [
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

// Two header rows and one nonempty, noncomment line of text (because why should
// this be valid CSV, I guess).
const HEADER_ROWS = 2 + 1;

export class OTTimetableStatistics extends CSV<HeaderKey> {
  public constructor(txt: string) {
    super(txt, {
      fieldDelimiter: FIELD_DELIMITER,
      headerRows: HEADER_ROWS,
      keys: HEADERS_IN_FILE_ORDER,
    });
  }

  public getBeginEndDelayDiffs(
    query: CSVQuery<HeaderKey> = {}
  ): Map<string, number> {
    return [
      ...new Set(this.query(query).map((record): string => record.course)),
    ]
      .map((course): [string, number] => {
        const records = this.query({ course });

        const begin = records[0];
        const end = records[records.length - 1];

        return [course, +end.departureDiffS - +begin.departureDiffS];
      })
      .reduce<Map<string, number>>((acc, [course, diff]): Map<
        string,
        number
      > => {
        acc.set(course, diff);
        return acc;
      }, new Map());
  }

  public getGroupedBeginEndDelayDiffs<T>(
    groupingReduce: (course: string) => T[],
    query: CSVQuery<HeaderKey>
  ): Map<T, number> {
    const groupeCourseDiffs = [...this.getBeginEndDelayDiffs(query)].reduce<
      MapSet<T, number>
    >((acc, [course, diff]): MapSet<T, number> => {
      for (const group of groupingReduce(course)) {
        acc.get(group).add(diff);
      }
      return acc;
    }, new MapSet());

    return [...groupeCourseDiffs].reduce<Map<T, number>>(
      (acc, [course, diffs]): Map<T, number> => {
        acc.set(
          course,
          [...diffs].reduce<number>((acc, diff): number => acc + diff, 0) /
            diffs.size
        );
        return acc;
      },
      new Map()
    );
  }
}
