import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import pkg from "./package.json" assert { type: "json" };
import babel from "rollup-plugin-babel";

import nodePolyfills from "rollup-plugin-polyfill-node";
export default [
  // browser-friendly UMD build
  {
    input: "src/index.js",
    output: {
      name: "PPT",
      file: pkg.browser,
      format: "umd",
    },
    plugins: [
      resolve({ browser: true }), // so Rollup can find `ms`
      commonjs(), // so Rollup can convert `ms` to an ES module
      babel({ presets: ["@babel/preset-env"] }),
      nodePolyfills(),
    ],
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: "src/index.js",
    external: ["sketchtojson", "psdtojson"],
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" },
    ],
    plugins: [babel({ presets: ["@babel/preset-env"] })],
  },
];
