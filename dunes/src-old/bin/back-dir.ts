import { mkdir, move, pathExists, readdir } from "fs-extra";
import { basename, dirname } from "path";
import globby from "globby";

(async (): Promise<void> => {
  const oldDirPath = process.argv[2];

  if (!(await pathExists(oldDirPath))) {
    console.info("The dir doesn't exist, nothing to back up.");
    console.info(`Creating an empty dir “${oldDirPath}”…`);
    await mkdir(oldDirPath);
    console.info(`Done`);
    return;
  }

  if ((await readdir(oldDirPath)).length === 0) {
    console.info("The dir is empty, nothing to back up.");
    return;
  }

  const oldDirBasename = basename(oldDirPath);
  const oldDirDirname = dirname(oldDirPath);
  const parentDirContents = await readdir(oldDirDirname);

  const i =
    1 +
    Math.max(
      0,
      ...parentDirContents
        .filter(
          (name): boolean =>
            name !== oldDirBasename && name.startsWith(oldDirBasename)
        )
        .map((name): string => name.slice(oldDirBasename.length))
        .filter((deprefixedName): boolean => /^-old\d+/.test(deprefixedName))
        .map(
          (deprefixedName): number =>
            +deprefixedName.replace(/^-old0*(\d+).*/, "$1")
        )
    );

  const backDirPath = `${oldDirPath}-old${i}`;

  console.info(`Moving old content to “${backDirPath}”…`);
  await move(oldDirPath, backDirPath);
  console.info(`Done`);

  console.info(`Recreating empty “${oldDirPath}”…`);
  await mkdir(oldDirPath);
  console.info(`Done`);

  const zeroPadLength = ("" + i).length;
  for (const oldPath of await globby(`${oldDirPath}-old*`.replace(/\\/g, "/"), {
    expandDirectories: false,
    onlyFiles: false,
  })) {
    const pathParts = oldPath.split("/");
    const suffix = pathParts[pathParts.length - 1].slice(oldDirBasename.length);
    const newPath = [
      ...pathParts.slice(0, -1),
      oldDirBasename +
        suffix.replace(
          /^(-old)(\d+)(.*)$/g,
          (_substring, start, ordinal, end): string =>
            [start, ordinal.padStart(zeroPadLength, "0"), end].join("")
        ),
    ].join("/");

    if (oldPath !== newPath) {
      console.info(`Zero padding “${oldPath}”…`);
      await move(oldPath, newPath);
      console.info(`Done`);
    }
  }
})().catch((error): void => {
  console.error(error);
  process.exitCode = 1;
});
