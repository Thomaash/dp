import { CurryLog } from "../curry-log";

export function buildChunkLogger(
  log: CurryLog,
  ...methods: (
    | ((line: string) => void)
    | "log"
    | "trace"
    | "debug"
    | "info"
    | "warn"
    | "error"
  )[]
): (chunk: string) => void {
  let text = "";

  const consumers = methods.map((method): ((line: string) => void) => {
    if (typeof method === "function") {
      return method;
    } else if (method === "error") {
      return log[method].bind(log, new Error("A chunk of error output."));
    } else {
      return log[method].bind(log);
    }
  });

  return (chunk): void => {
    text += chunk;
    const parts = text.split("\n");

    const last = parts.pop();
    if (last !== "" && last != null) {
      text = last;
    } else {
      text = "";
    }

    parts.forEach((part): void => {
      consumers.forEach((consumer): void => void consumer(part));
    });
  };
}
