import { createWriteStream } from "fs";
import { inspect } from "util";

import { formatISO9075 } from "date-fns";

import { CurryLogLevel } from "./base-types";

export interface CurryLogConsumerParams {
  time: number;
  path: string;
  level: CurryLogLevel;
  error: Error | null;
  messages: readonly any[];
}
export type CurryLogConsumer = (
  params: CurryLogConsumerParams
) => void | Promise<void>;

export function curryLogConsoleConsumer({
  error,
  level,
  messages,
  path,
  time,
}: CurryLogConsumerParams): void {
  if (error == null) {
    /* eslint-disable-next-line no-console */
    console[level](
      `➤ /${path} - ${formatISO9075(time)}\n`,
      ...messages,
      "\n\n"
    );
  } else {
    /* eslint-disable-next-line no-console */
    console[level](
      `➤ /${path} - ${formatISO9075(time)}\n`,
      error,
      ...messages,
      "\n\n"
    );
  }
}

export function curryLogNoPathConsoleConsumer({
  error,
  level,
  messages,
  time,
}: CurryLogConsumerParams): void {
  if (error == null) {
    /* eslint-disable-next-line no-console */
    console[level](`➤ ${formatISO9075(time)}\n`, ...messages, "\n\n");
  } else {
    /* eslint-disable-next-line no-console */
    console[level](`➤ ${formatISO9075(time)}\n`, error, ...messages, "\n\n");
  }
}

export function curryLogCleanConsoleConsumer({
  error,
  level,
  messages,
}: CurryLogConsumerParams): void {
  if (error != null) {
    /* eslint-disable-next-line no-console */
    console[level](error);
  }

  /* eslint-disable-next-line no-console */
  console[level](...messages);
}

const levelLetters = Object.freeze<Record<CurryLogLevel, string>>({
  debug: "d",
  error: "e",
  info: "i",
  log: "L",
  trace: "t",
  warn: "w",
});
export function createCurryLogFileConsumer(path: string): CurryLogConsumer {
  const writeStream = createWriteStream(path);

  return function curryLogFileConsumer({
    error,
    level,
    messages,
    path,
    time,
  }: CurryLogConsumerParams): void {
    // Don't use os.EOL here as util.inspect is allways POSIX.
    writeStream.write(
      [
        `➤ ${levelLetters[level]} /${path} - ${formatISO9075(time)}`,
        ...(error != null ? [inspect(error)] : []),
        ...messages.map((message): string =>
          typeof message === "string"
            ? message
            : inspect(message, { depth: Number.POSITIVE_INFINITY })
        ),
        "",
        "",
      ].join("\n"),
      "utf-8"
    );
  };
}
