import { defineConfig } from "vite";
import path from "path";
import vue from "@vitejs/plugin-vue";
const alias = [];
if (process.env.NODE_ENV != "production") {
  alias.push({ find: /^tojson.js$/, replacement: path.join(__dirname, "../packages/tojson.js/src/index.js") });
}
if (process.env.NODE_ENV != "production") {
  alias.push({ find: /^sketch$/, replacement: path.join(__dirname, "../packages/sketchtojson/src/index.js") });
}
export default defineConfig({
  resolve: {
    alias,
  },
  plugins: [vue()],
});
