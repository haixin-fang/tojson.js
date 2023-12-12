import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import pkg from "./package.json" assert { type: "json" };
import babel from "@rollup/plugin-babel";
import json from "@rollup/plugin-json";

import nodePolyfills from "rollup-plugin-polyfill-node";

export default [
  // browser-friendly UMD build
  {
    input: "src/index.js",
    output: {
      name: "Psd",
      file: pkg.browser,
      format: "umd",
    },
    plugins: [
      json(),
      resolve({ browser: true, preferBuiltins: false }), // so Rollup can find `ms`
      commonjs(), // so Rollup can convert `ms` to an ES module
      nodePolyfills(),
      babel({ presets: ["@babel/preset-env"] }),
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
    external: ["psd.js", "buffer", "uuid"],
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" },
    ],
    plugins: [babel({ presets: ["@babel/preset-env"] })],
  },
];
