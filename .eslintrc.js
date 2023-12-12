module.exports = {
  env: {
    node: true,
    browser: true,
    es6: true,
  },
  extends: ["eslint:recommended", "plugin:vue/vue3-essential"],
  parserOptions: {
    // Use babel-eslint for JavaScript
    parser: "babel-eslint",
    ecmaVersion: 2017,
    // With import/export syntax
    sourceType: "module",
  },
  rules: {},
};
