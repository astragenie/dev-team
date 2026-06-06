import { defineConfig } from "orval";

// Reference template — consumer repos copy this to their root.
export default defineConfig({
  featDemo: {
    input: "tests/fixtures/openapi/valid-feat.openapi.yaml",
    output: {
      target: "tests/fixtures/orval/feat-demo.client.ts",
      client: "fetch",
      mode: "single",
    },
  },
});
