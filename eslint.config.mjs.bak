// Minimal flat ESLint config. Enforces readability gates without requiring a
// TypeScript migration. Targets Node 20+ ESM.
//
// Why these rules:
// - no-unused-vars / prefer-const / no-var: dead-code + mutation hygiene
// - no-console: tolerated in CLI entry-points + the bundled smoke / validator
//   scripts; everywhere else it's noise
// - max-lines-per-function / complexity: kept generous (120 / 15) because the
//   existing code has long but linear functions; the goal is to flag genuinely
//   tangled growth, not force a rewrite of working code
// - eqeqeq: strict equality only

import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["tests/fixtures/**", "**/*.openapi.yaml"]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "eqeqeq": ["error", "smart"],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-implicit-globals": "error",
      "max-lines-per-function": ["warn", { max: 120, skipBlankLines: true, skipComments: true }],
      "complexity": ["warn", 15]
    }
  },
  {
    files: ["tests/**/*.{mjs,ts}"],
    rules: {
      "max-lines-per-function": "off",
      "complexity": "off"
    }
  }
];
