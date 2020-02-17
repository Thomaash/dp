import builtins from "builtin-modules";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import packageJSON from "./package.json";
import typescript2 from "rollup-plugin-typescript2";
import { join } from "path";

export default [
  {
    input: "src/index.ts",
    external: [
      ...builtins,
      ...Object.keys(packageJSON.dependencies || {}),
      ...Object.keys(packageJSON.peerDependencies || {}),
      ...Object.keys(packageJSON.devDependencies || {})
    ],
    output: {
      file: join(process.env.DIST || "./dist", "index.js"),
      format: "cjs",
      sourcemap: true
    },
    plugins: [
      nodeResolve({
        extensions: [".ts", ".js"],
        mainFields: ["module", "main"],
        preferBuiltins: true
      }),
      json(),
      typescript2({ tsconfig: "./tsconfig.rollup.json" }),
      commonjs({
        namedExports: {
          chai: ["expect"]
        }
      })
    ]
  }
];