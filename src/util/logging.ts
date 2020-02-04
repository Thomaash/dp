export function buildChunkLogger(
  prefix: string,
  ...methods: (((line: string) => void) | "log" | "info" | "warn" | "error")[]
): (chunk: string) => void {
  let text = "";

  const consumers = methods.map((method): ((line: string) => void) =>
    typeof method === "function" ? method : console[method].bind(console)
  );

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
      consumers.forEach(
        (consumer): void => void consumer(`${prefix}: ${part}`)
      );
    });
  };
}
