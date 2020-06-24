const EMPTY_RE = /^\s*$/;
const LINE_DELIMITER_RE = /(\n\r|\n|\r)/;

export interface CSVOptions<Key extends string | number | symbol> {
  fieldDelimiter: string;
  headerRows: number;
  keys: readonly Key[];
}

export type CSVRecord<Key extends string> = Record<Key | number, string>;
export type CSVQuery<Key extends string> = {
  readonly [K in Key | number]?: string;
};

export class CSV<HK extends string> {
  private readonly _data: CSVRecord<HK>[];

  public constructor(input: string, options: Partial<CSVOptions<HK>> = {}) {
    const fieldDelimiter = options.fieldDelimiter ?? ",";
    const headerRows = options.headerRows ?? 0;
    const keys = options.keys ?? [];

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
        (fields): CSVRecord<HK> =>
          fields.reduce<CSVRecord<HK>>((acc, field, i): CSVRecord<HK> => {
            acc[i] = field;
            if (keys[i] != null) {
              acc[keys[i]] = field;
            }
            return acc;
          }, Object.create(null) as CSVRecord<HK>)
      );
  }

  public query(query: CSVQuery<HK> = {}): CSVRecord<HK>[] {
    return this._data
      .filter((record): boolean => {
        for (const [key, value] of Object.entries(query)) {
          if (
            ((record as unknown) as Record<string | number, unknown>)[key] !==
            value
          ) {
            return false;
          }
        }

        return true;
      })
      .map((record): CSVRecord<HK> => ({ ...record }));
  }
}
