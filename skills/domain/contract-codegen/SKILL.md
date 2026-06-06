---
name: contract-codegen
tier: domain
description: Per-stack codegen recipes for FE clients/mocks and BE stubs/types from a FEAT's OpenAPI YAML. Run as the first step before any feature work.
owner: hero-crew
last_reviewed: 2026-06-06
triggers: ["builder-fe consumes a new or revised contracts.openapi.yaml", "builder-be consumes a new or revised contracts.openapi.yaml"]
---

# Contract codegen (per-stack recipes)

## When to Use

You are `crew:builder-fe` or `crew:builder-be` and the slice has a FEAT-scoped `contracts.openapi.yaml`. Run codegen as your FIRST step. Treat the YAML as read-only.

## FE recipes

### orval (typed client)

Config lives at `orval.config.ts` (repo-root). Reference template:

```ts
import { defineConfig } from "orval";

export default defineConfig({
  feat: {
    input: ".claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml",
    output: {
      target: "src/api/feat-NNN.ts",
      client: "fetch", // or "react-query" / "swr"
      mode: "single",
    },
  },
});
```

Run:

```bash
npx orval --config orval.config.ts
```

Commit the generated `src/api/feat-NNN.ts`. CI hashes the regenerated output against the committed copy; mismatch fails.

### openapi-msw (MSW handlers from examples)

Config lives at `src/mocks/feat-NNN.ts` (handler module). Reference template:

```ts
import { http, HttpResponse } from "msw";
import spec from "../../.claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml";
// note: vite-plugin-yaml or a similar yaml-as-module loader required

export const featNNNHandlers = [
  // openapi-msw or msw-auto-mock can emit these programmatically;
  // see https://github.com/iyegoroff/openapi-msw for the supported config.
];
```

Where to invoke during dev:

```ts
// src/mocks/browser.ts
import { setupWorker } from "msw/browser";
import { featNNNHandlers } from "./feat-NNN";
export const worker = setupWorker(...featNNNHandlers);
```

Commit the regenerated handlers. CI hashes the regenerated output against the committed copy.

## BE recipes

See FEAT-D — this section is added in that FEAT's slice 1.

## Done when

- All codegen commands exit 0
- No diff in generated artifacts vs committed copy (FE: `src/api/`, `src/mocks/`; BE: per-stack — covered by FEAT-D)
- Generated artifacts compile / typecheck
