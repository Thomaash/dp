export function buildChunkLogger(
  prefix: string,
  method: "log" | "info" | "warn" | "error"
): (chunk: string) => void {
  let text = "";

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
      console[method](`${prefix}: ${part}`);
    });
  };
}
