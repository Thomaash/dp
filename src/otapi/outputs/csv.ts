const EMPTY_RE = /^\s*$/;
const LINE_DELIMITER_RE = /(\n\r|\n|\r)/;

type RawCSVRecord<Key extends string> = Record<Key, string>;

export function toNumber(value: string): number {
  if (Number.isNaN(value)) {
    throw new TypeError(`Not a valid number: "${value}".`);
  }
  return +value;
}

export function toString(value: string): string {
  return value;
}

export interface CSVOptions<
  CSVRecord extends Record<HK, any>,
  HK extends string
> {
  fieldDelimiter?: string;
  headerRows?: number;
  keys: readonly HK[];
  convert: {
    [Key in keyof CSVRecord]: (
      value: string,
      key: Key,
      record: RawCSVRecord<HK>
    ) => CSVRecord[Key];
  };
}

export class CSV<CSVRecord extends Record<HK, any>, HK extends string> {
  private readonly _data: CSVRecord[];

  public constructor(
    input: string,
    {
      convert,
      fieldDelimiter = ",",
      headerRows = 0,
      keys,
    }: CSVOptions<CSVRecord, HK>
  ) {
    this._data = input
      // Split into an array of lines.
      .split(LINE_DELIMITER_RE)
      // Remove comment lines.
      .filter((line): boolean => !line.startsWith("//"))
      // Remove empty lines.
      .filter((line): boolean => !EMPTY_RE.test(line))
      // Skip header rows.
      .slice(headerRows)
      // Split each line into array of fields.
      .map((line): string[] => line.split(fieldDelimiter))
      // Convert arrays of fields into records.
      .map(
        (fields): RawCSVRecord<HK> =>
          fields.reduce<RawCSVRecord<HK>>((acc, field, i): RawCSVRecord<HK> => {
            if (keys[i] != null) {
              acc[keys[i]] = field;
            }
            return acc;
          }, Object.create(null) as RawCSVRecord<HK>)
      )
      // Convert using user converters.
      .map(
        (rawCSVRecord): CSVRecord => {
          const csvRecord: any = {};
          for (const [key, value] of (Object.entries(
            rawCSVRecord
          ) as unknown) as readonly [HK, string][]) {
            csvRecord[key] = convert[key](value, key, rawCSVRecord);
          }
          return csvRecord;
        }
      );
  }

  public query(query: Partial<CSVRecord>): CSVRecord[] {
    return this.filter((record: Record<string, unknown>): boolean => {
      for (const [key, value] of Object.entries(query)) {
        if (record[key] !== value) {
          return false;
        }
      }

      return true;
    });
  }

  public filter(
    callback: (record: CSVRecord, index: number, array: CSVRecord[]) => boolean
  ): CSVRecord[] {
    return this._data
      .map((record): CSVRecord => ({ ...record }))
      .filter(callback);
  }
}
