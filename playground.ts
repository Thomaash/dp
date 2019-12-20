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

