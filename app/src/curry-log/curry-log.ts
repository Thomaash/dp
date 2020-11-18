const allowed = new Set<string>();

import {
  CurryLogConsumer,
  CurryLogConsumerParams,
  curryLogConsoleConsumer,
} from "./consumers";
import { CurryLogLevel } from "./base-types";

export interface CurryLog {
  (...pathParts: readonly string[]): CurryLog;

  log(...rest: Parameters<typeof console["log"]>): void;

  trace(...rest: Parameters<typeof console["trace"]>): void;
  debug(...rest: Parameters<typeof console["debug"]>): void;
  info(...rest: Parameters<typeof console["info"]>): void;
  warn(...rest: Parameters<typeof console["warn"]>): void;
  error(error: Error, ...rest: Parameters<typeof console["error"]>): void;
}

function isAllowed(paths: string[]): boolean {
  return allowed.size === 0 || paths.some((path): boolean => allowed.has(path));
}

interface LogItThis {
  consumers: CurryLogConsumer[];
  method: CurryLogLevel;
  path: string;
  paths: string[];
}
async function logIt(
  this: LogItThis,
  error: Error | null,
  ...messages: any[]
): Promise<void> {
  if (!isAllowed(this.paths)) {
    return;
  }

  const consumerParams: CurryLogConsumerParams = {
    time: Date.now(),
    path: this.path,
    level: this.method,
    error,
    messages: Object.freeze<any[]>(messages),
  };
  Object.freeze(consumerParams);

  for (const consumer of this.consumers) {
    await consumer(consumerParams);
  }
}

export interface CurryLogRoot {
  allow(...pathParts: string[]): void;
  disallow(...pathParts: string[]): void;
  reset(...pathParts: string[]): void;

  get(...pathParts: readonly string[]): CurryLog;
}

export function curryLog(...consumers: CurryLogConsumer[]): CurryLogRoot {
  if (consumers.length === 0) {
    consumers.push(curryLogConsoleConsumer);
  }

  function allow(...pathParts: string[]): void {
    const path = pathParts.join("/");

    allowed.add(path);
  }
  function disallow(...pathParts: string[]): void {
    const path = pathParts.join("/");

    allowed.delete(path);
  }
  function reset(): void {
    allowed.clear();
  }

  const loggers = new Map<string, CurryLog>();
  function get(...pathParts: readonly string[]): CurryLog {
    const path = pathParts.join("/");

    const logger = loggers.get(path);
    if (logger) {
      return logger;
    }

    const paths = path
      .split("/")
      .map((_, i, arr): string => arr.slice(0, i + 1).join("/"));

    const newLog: CurryLog = (get.bind(null, path) as any) as CurryLog;

    newLog.log = logIt.bind(
      Object.freeze<LogItThis>({ consumers, path, paths, method: "log" }),
      null
    );
    newLog.trace = logIt.bind(
      Object.freeze<LogItThis>({ consumers, path, paths, method: "trace" }),
      null
    );
    newLog.debug = logIt.bind(
      Object.freeze<LogItThis>({ consumers, path, paths, method: "debug" }),
      null
    );
    newLog.info = logIt.bind(
      Object.freeze<LogItThis>({ consumers, path, paths, method: "info" }),
      null
    );
    newLog.warn = logIt.bind(
      Object.freeze<LogItThis>({ consumers, path, paths, method: "warn" }),
      null
    );
    newLog.error = logIt.bind(
      Object.freeze<LogItThis>({ consumers, path, paths, method: "error" })
    );

    Object.freeze<CurryLog>(newLog);

    loggers.set(path, newLog);
    return newLog;
  }

  const root: CurryLogRoot = {
    allow,
    disallow,
    reset,

    get,
  };
  Object.freeze(root);
  return root;
}

export function curryCatch(
  log: CurryLog,
  ...messages: any[]
): (error: Error) => void {
  return (error: Error): void => {
    log.error(error, ...messages);
  };
}
