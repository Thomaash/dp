import { CSV, toString } from "./csv";
import { MapSet } from "../../util";

export interface OTTimetableStatisticsRecord {
  course: string;
  station: string;
  arrivalPlannedHHMMSS: string;
  arrivalPlannedS: null | number;
  departurePlannedHHMMSS: string;
  departurePlannedS: null | number;
  arrivalActualHHMMSS: string;
  arrivalActualS: null | number;
  departureActualHHMMSS: string;
  departureActualS: null | number;
  arrivalDiffHHMMSS: string;
  arrivalDiffS: null | number;
  departureDiffHHMMSS: string;
  departureDiffS: null | number;
  trackPlanned: string;
  trackActual: string;
}

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
  "trackPlanned",
  "trackActual",
] as const;
type HeaderKey = typeof HEADERS_IN_FILE_ORDER[number];

const FIELD_DELIMITER = "\t";

// Two header rows and one nonempty, noncomment line of text (because why should
// this be valid CSV, I guess).
const HEADER_ROWS = 2 + 1;

const NEVER_REACHED_HHMMSS = "XX:XX:XX";
const NO_DATA_HHMMSS = "HH:MM:SS";

/**
 * Check if HH:MM:SS value is an actual time or not.
 *
 * @param hhmmss - The value from a CSV file.
 *
 * @returns True if it's a time, false if it's a special value (like HH:MM:SS
 * or XX:XX:XX).
 */
function isValidHHMMSS(hhmmss: string): boolean {
  return hhmmss !== NO_DATA_HHMMSS && hhmmss !== NEVER_REACHED_HHMMSS;
}

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
function normalizeDelayDiffS(s: number): number {
  return Math.max(s, 0);
}

export class OTTimetableStatistics extends CSV<
  OTTimetableStatisticsRecord,
  HeaderKey
> {
  public constructor(txt: string) {
    super(txt, {
      fieldDelimiter: FIELD_DELIMITER,
      headerRows: HEADER_ROWS,
      keys: HEADERS_IN_FILE_ORDER,
      convert: {
        course: toString,
        station: toString,
        arrivalPlannedHHMMSS: toString,
        arrivalPlannedS(value, _key, rawRecord): null | number {
          if (isValidHHMMSS(rawRecord.arrivalPlannedHHMMSS)) {
            return +value;
          } else {
            return null;
          }
        },
        departurePlannedHHMMSS: toString,
        departurePlannedS(value, _key, rawRecord): null | number {
          if (isValidHHMMSS(rawRecord.departurePlannedHHMMSS)) {
            return +value;
          } else {
            return null;
          }
        },
        arrivalActualHHMMSS: toString,
        arrivalActualS(value, _key, rawRecord): null | number {
          if (isValidHHMMSS(rawRecord.arrivalActualHHMMSS)) {
            return +value;
          } else {
            return null;
          }
        },
        departureActualHHMMSS: toString,
        departureActualS(value, _key, rawRecord): null | number {
          if (isValidHHMMSS(rawRecord.departureActualHHMMSS)) {
            return +value;
          } else {
            return null;
          }
        },
        arrivalDiffHHMMSS: toString,
        arrivalDiffS(value, _key, rawRecord): null | number {
          if (
            isValidHHMMSS(rawRecord.arrivalPlannedHHMMSS) &&
            isValidHHMMSS(rawRecord.arrivalActualHHMMSS)
          ) {
            return +value;
          } else {
            return null;
          }
        },
        departureDiffHHMMSS: toString,
        departureDiffS(value, _key, rawRecord): null | number {
          if (
            isValidHHMMSS(rawRecord.departurePlannedHHMMSS) &&
            isValidHHMMSS(rawRecord.departureActualHHMMSS)
          ) {
            return +value;
          } else {
            return null;
          }
        },
        trackPlanned: toString,
        trackActual: toString,
      },
    });
  }

  public getBeginEndDelayDiffs(
    query: Partial<OTTimetableStatisticsRecord> = {}
  ): Map<string, number> {
    return (
      // Get all available courses.
      [...new Set(this.query(query).map((record): string => record.course))]
        // Get records for each course.
        .map((course): [string, OTTimetableStatisticsRecord[]] => [
          course,
          this.query({ course })
            // Keep only records with defined arrival or departure times.
            .filter(
              (record): boolean =>
                (isValidHHMMSS(record.arrivalPlannedHHMMSS) &&
                  isValidHHMMSS(record.arrivalActualHHMMSS) &&
                  record.arrivalDiffHHMMSS !== NEVER_REACHED_HHMMSS) ||
                (isValidHHMMSS(record.departurePlannedHHMMSS) &&
                  isValidHHMMSS(record.departureActualHHMMSS) &&
                  record.departureDiffHHMMSS !== NEVER_REACHED_HHMMSS)
            ),
        ])
        // Keep only courses with more than one record.
        .filter(([, records]): boolean => records.length > 1)
        // Compute delay increase/decrease for each course.
        .map(([course, records]): [string, number] => {
          const begin = records[0];
          const beginDiffS = normalizeDelayDiffS(
            begin.arrivalDiffS ?? begin.departureDiffS ?? 0
          );

          const end = records[records.length - 1];
          const endDiffS = normalizeDelayDiffS(
            end.departureDiffS ?? end.arrivalDiffS ?? 0
          );

          return [course, endDiffS - beginDiffS];
        })
        // Reduce into a map (course -> delay diff in seconds).
        .reduce<Map<string, number>>((acc, [course, diff]): Map<
          string,
          number
        > => {
          acc.set(course, diff);
          return acc;
        }, new Map())
    );
  }

  public getGroupedBeginEndDelayDiffs<GroupName>(
    groupingReduce: (course: string) => GroupName[],
    query: Partial<OTTimetableStatisticsRecord>
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

  /**
   * Get the ids of trains that have XX:XX:XX (never reached) in their
   * timetables.
   *
   * @returns A set of train ids.
   */
  public getXXTrainIds(): Set<string> {
    return new Set<string>(
      this.filter(
        ({ departureActualHHMMSS, arrivalActualHHMMSS }): boolean =>
          departureActualHHMMSS === NEVER_REACHED_HHMMSS &&
          arrivalActualHHMMSS === NEVER_REACHED_HHMMSS
      ).map((record): string => record.course)
    );
  }
}
