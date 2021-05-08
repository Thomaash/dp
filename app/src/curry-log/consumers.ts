import { appendFile as appendFileCallback, createWriteStream } from "fs";
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
    console[level]("#", error.name, error.message);
  }

  /* eslint-disable-next-line no-console */
  console[level](...messages);
}

const levelLetters = Object.freeze<Record<CurryLogLevel, string>>({
  debug: "D",
  error: "E",
  info: "I",
  log: "L",
  trace: "T",
  warn: "W",
});
export function createCurryLogStreamFileConsumer(
  logFilePath: string
): CurryLogConsumer {
  const writeStream = createWriteStream(logFilePath);

  return function curryLogFileConsumer({
    error,
    level,
    messages,
    path,
    time,
  }: CurryLogConsumerParams): void {
    // Don't use os.EOL here as util.inspect is always POSIX.
    writeStream.write(
      [
        `➤ ${levelLetters[level]} /${path} - ${formatISO9075(time)}`,
        ...(error != null ? [error.stack ?? inspect(error)] : []),
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
export function createCurryLogAppendFileConsumer(
  logFilePath: string
): CurryLogConsumer {
  return function curryLogFileConsumer({
    error,
    level,
    messages,
    path,
    time,
  }: CurryLogConsumerParams): void {
    // Don't use os.EOL here as util.inspect is always POSIX.
    appendFileCallback(
      logFilePath,
      [
        `➤ ${levelLetters[level]} /${path} - ${formatISO9075(time)}`,
        ...(error != null ? [error.stack ?? inspect(error)] : []),
        ...messages.map((message): string =>
          typeof message === "string"
            ? message
            : inspect(message, { depth: Number.POSITIVE_INFINITY })
        ),
        "",
        "",
      ].join("\n"),
      "utf-8",
      (error): void => {
        if (error != null) {
          /* eslint-disable-next-line no-console */
          console.error("Error occurred while appending to the log.");
          /* eslint-disable-next-line no-console */
          console.error(error);
        }
      }
    );
  };
}
