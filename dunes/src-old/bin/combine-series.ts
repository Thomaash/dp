import { readFile, writeFile } from "fs-extra";

(async (): Promise<void> => {
  const outPath = process.argv[2];
  const inPaths = process.argv.slice(3);
  const inValues = (
    await Promise.all(
      inPaths.map((path): Promise<string> => readFile(path, "utf-8"))
    )
  ).map((text): string[][] =>
    text
      .split("\n")
      .map((line): string => line)
      .filter((line): boolean => line.trim().length > 0)
      .map((line): string[] => line.split("\t").slice(1))
  );
  const length = Math.max(...inValues.map(({ length }): number => length));
  const outText = [
    [
      "#",
      ...inValues.flatMap((values, inIndex): string[] =>
        values[0].map(
          (_, columnIndex): string => `${inPaths[inIndex]} #${columnIndex + 1}`
        )
      ),
    ].join("\t"),
    ...new Array(length)
      .fill(null)
      .map((_, i): string =>
        [i + 1, ...inValues.flatMap((values): string[] => values[i])].join("\t")
      ),
  ].join("\n");
  await writeFile(outPath, outText, "utf-8");
})().catch((error): void => {
  console.error(error);
  process.exitCode = 1;
});
