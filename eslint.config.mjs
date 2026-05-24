import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "warn",
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "no-extra-boolean-cast": "warn"
    }
  },
  {
    ignores: [
      "docs/**",
      "node_modules/**",
      "public/vendor/**",
      "public/dist/**",
      "public/canvas-v2/**",
      "external/**",
      "apps/**",
      "**/*.min.js"
    ]
  }
];
