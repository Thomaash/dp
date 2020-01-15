// Header {{{
// vim:fdm=marker

console.log("==> PLAYGROUND");
Object.entries(process.versions)
  .sort(([a], [b]): number => a.localeCompare(b))
  .forEach(([name, version]): void => {
    console.log(`  ${name}: ${version}`);
  });
console.log("\n");

// }}}

import { PopulationGenerator, statements } from "./src/ga";

const generator = new PopulationGenerator("PLAYGROUND", statements);

console.time("Generation");
const tree = generator.full(10);
console.timeEnd("Generation");

console.log(`root: ${tree.name}`);
