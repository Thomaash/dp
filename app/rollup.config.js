import builtins from "builtin-modules";
import commonjs from "@rollup/plugin-commonjs";
import copy from "rollup-plugin-copy";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import packageJSON from "./package.json";
import typescript2 from "rollup-plugin-typescript2";
import { join } from "path";

function sortProps(object) {
  return Object.keys(object)
    .sort()
    .reduce((acc, key) => {
      const value = object[key];
      acc[key] = Array.isArray(value)
        ? [...value]
        : typeof value === "object" && value !== null
        ? sortProps(value)
        : value;
      return acc;
    }, {});
}

function adjustPackageJSON(packageJSON) {
  const tmpPackageJSON = { ...packageJSON };

  delete tmpPackageJSON.config;
  delete tmpPackageJSON.devDependencies;
  delete tmpPackageJSON.husky;
  delete tmpPackageJSON.mocha;
  delete tmpPackageJSON.nyc;
  delete tmpPackageJSON.scripts;

  tmpPackageJSON.name = ["@tomina", tmpPackageJSON.name].join("/");
  tmpPackageJSON.publishConfig = {
    access: "public",
  };

  tmpPackageJSON.files = ["**"];

  // Make sure that the order of the properties is stable.
  return sortProps(tmpPackageJSON);
}

const plugins = (declarations) => [
  nodeResolve({
    extensions: [".ts", ".js"],
    mainFields: ["module", "main"],
    preferBuiltins: true,
  }),
  json(),
  typescript2({
    tsconfig: "./tsconfig.rollup.json",
    tsconfigOverride: {
      compilerOptions: {
        declaration: declarations,
        declarationMap: declarations,
      },
    },
  }),
  commonjs({
    extensions: [
      ".js",
      "", // Yargs uses files without extensions.
    ],
  }),
];

const DIST_APP = process.env.DIST_APP || join("dist", "app");
const DIST_OTAPI = process.env.DIST_OTAPI || join("dist", "otapi");

export default [
  {
    input: "src/otapi/index.ts",
    external: [
      ...builtins,
      ...Object.keys(packageJSON.dependencies || {}),
      ...Object.keys(packageJSON.peerDependencies || {}),
      ...Object.keys(packageJSON.devDependencies || {}),
    ],
    output: {
      file: join(DIST_OTAPI, "index.js"),
      format: "cjs",
      sourcemap: true,
    },
    plugins: plugins(true),
  },
  {
    input: "src/index.ts",
    external: [
      ...builtins,
      ...Object.keys(packageJSON.dependencies || {}),
      ...Object.keys(packageJSON.peerDependencies || {}),
      ...Object.keys(packageJSON.devDependencies || {}),
    ],
    output: {
      file: join(DIST_APP, "index.js"),
      format: "cjs",
      sourcemap: true,
    },
    plugins: [
      ...plugins(false),
      copy({
        targets: [
          { src: "static-app-assets/*", dest: DIST_APP },
          {
            src: "package.json",
            dest: DIST_APP,
            transform(contents) {
              return JSON.stringify(
                adjustPackageJSON(JSON.parse(contents.toString())),
                undefined,
                4
              );
            },
          },
        ],
      }),
    ],
  },
];
