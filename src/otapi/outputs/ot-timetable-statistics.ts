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

const EMPTY_RE = /^\s*$/;
const FIELD_DELIMITER = "\t";
const HEADER_ROWS = 2;
const LINE_DELIMITER_RE = /(\n\r|\n|\r)/;

interface PreprocessCSVOptions<Key extends string | number | symbol> {
  fieldDelimiter: string;
  headerRows: number;
  keys: readonly Key[];
}
function processCSV<Key extends string | number | symbol>(
  input: string,
  { fieldDelimiter, headerRows, keys }: PreprocessCSVOptions<Key>
): Record<Key, string>[] {
  return (
    input
      // Split into an array of lines.
      .split(LINE_DELIMITER_RE)
      // Remove comment lines.
      .filter((line): boolean => !line.startsWith("//"))
      // Remove empty lines.
      .filter((line): boolean => line.length !== 0 && !EMPTY_RE.test(line))
      // Skip header rows.
      .slice(headerRows)
      // Split each line into array of fields.
      .map((line): string[] => line.split(fieldDelimiter))
      // Convert arrays of fields into records.
      .map(
        (fields): Record<Key, string> =>
          fields.reduce<Record<Key, string>>((acc, field, i): Record<
            Key,
            string
          > => {
            acc[keys[i]] = field;
            return acc;
          }, Object.create(null) as Record<Key, string>)
      )
  );
}

export class OTTimetableStatistics {
  private readonly _data: Record<HeaderKey, string>[];

  public constructor(txt: string) {
    this._data = processCSV(txt, {
      fieldDelimiter: FIELD_DELIMITER,
      headerRows: HEADER_ROWS,
      keys: HEADERS_IN_FILE_ORDER,
    });
  }

  public query(
    query: { readonly [Key in HeaderKey]?: string }
  ): Record<HeaderKey, string>[] {
    return this._data
      .filter((record): boolean => {
        for (const [key, value] of Object.entries(query)) {
          if ((record as Record<string, unknown>)[key] !== value) {
            return false;
          }
        }

        return true;
      })
      .map((record): Record<HeaderKey, string> => ({ ...record }));
  }
}
