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

/**
 * Turn raw string delay diff seconds from CSV into meaningful numeric value.
 *
 * @remarks
 * Negative delays are considered no delay (0s).
 *
 * @param s - The *DiffS value straight from CSV.
 *
 * @returns Meaningful numeric value (0+).
 */
function normalizeDelayDiffS(s: string): number {
  return Math.max(+s, 0);
}

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
        const beginDiffS = normalizeDelayDiffS(begin.departureDiffS);

        const end = records[records.length - 1];
        const endDiffS = normalizeDelayDiffS(end.departureDiffS);

        return [course, +end.departureDiffS - +begin.departureDiffS];
        return [course, endDiffS - beginDiffS];
      })
      .reduce<Map<string, number>>((acc, [course, diff]): Map<
        string,
        number
      > => {
        acc.set(course, diff);
        return acc;
      }, new Map());
  }

  public getGroupedBeginEndDelayDiffs<GroupName>(
    groupingReduce: (course: string) => GroupName[],
    query: CSVQuery<HeaderKey>
  ): Map<GroupName, number> {
    const perGroupDiffs = [...this.getBeginEndDelayDiffs(query)].reduce<
      MapSet<GroupName, number>
    >((acc, [course, diff]): MapSet<GroupName, number> => {
      for (const group of groupingReduce(course)) {
        acc.get(group).add(diff);
      }
      return acc;
    }, new MapSet());

    return [...perGroupDiffs].reduce<Map<GroupName, number>>(
      (acc, [group, diffs]): Map<GroupName, number> => {
        acc.set(
          group,
          [...diffs].reduce<number>((acc, diff): number => acc + diff, 0) /
            diffs.size
        );
        return acc;
      },
      new Map()
    );
  }
}
