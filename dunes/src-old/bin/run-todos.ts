import { readFile, writeFile } from "fs-extra";
import { spawn } from "child_process";

(async (): Promise<void> => {
  const todoPath = process.argv[2];

  for (;;) {
    const todos = (await readFile(todoPath, "utf-8")).split("\n");
    const nextIndex = todos.findIndex((line): boolean =>
      /^\s*npm run start/.test(line)
    );

    if (nextIndex >= 0) {
      const command = todos[nextIndex]
        .replace(/^\s*/g, "")
        .replace(/\s*$/g, "")
        .replace(/  +/g, " ");
      console.info(`==> ${command}: starting...`);

      await writeFile(
        todoPath,
        [
          ...todos.slice(0, nextIndex),
          todos[nextIndex].replace(/^ ?/, "#"),
          ...todos.slice(nextIndex + 1),
        ].join("\n")
      );

      await new Promise<void>((resolve, reject): void => {
        const child = spawn("npm", ["install"], {
          shell: true,
          stdio: "inherit",
        });
        child.on("exit", (code): void => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Running “npm install“ failed with ${code}.`));
          }
        });
      });
      const commandParts = command.split(" ");
      const success = await new Promise<boolean>((resolve): void => {
        const child = spawn(commandParts[0], commandParts.slice(1), {
          shell: true,
          stdio: "inherit",
        });
        child.on("exit", (code): void => {
          console.info(`Exit code: ${code}.`);
          resolve(code === 0);
        });
      });

      if (success) {
        console.info(`==> ${command}: succeeded`);
      } else {
        console.info(`==> ${command}: failed`);
      }
    } else {
      console.info("Waiting...");
      await new Promise((resolve): void => void setTimeout(resolve, 5000));
    }
  }
})().catch((error): void => {
  console.error(error);
  process.exitCode = 1;
});
