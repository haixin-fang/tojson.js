import { defineConfig } from "vite";
import path from "path";
import vue from "@vitejs/plugin-vue";
const alias = [];
console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV != "production") {
  alias.push({ find: /^tojson.js$/, replacement: path.join(__dirname, "../packages/tojson.js/src/index.js") });
  alias.push({ find: /^sketch$/, replacement: path.join(__dirname, "../packages/sketchtojson/src/index.js") });
} 
export default defineConfig({
  resolve: {
    alias,
  },
  base: "/tojson.js/playground",
  plugins: [vue()],
});
