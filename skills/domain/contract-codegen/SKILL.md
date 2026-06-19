---
name: contract-codegen
prompt_id: contract-codegen
version: 1.0.0
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

Pick the per-stack recipe that matches the FEAT's backend language. Each consumer repo
declares its codegen tool in `.claude/loop.json` (see
[`loop-json-schema.md`](./loop-json-schema.md)). Builder reads that config in its first
step. Missing entry for the FEAT's stack →
`mark-badge help_request --note "codegen tool not declared for stack:<X>"`.

- C# / .NET — NSwag (default) or Kiota (alternative): see [`be-csharp.md`](./be-csharp.md)
- Python — datamodel-code-generator + fastapi-code-generator: see [`be-python.md`](./be-python.md)
- Go — oapi-codegen: see [`be-go.md`](./be-go.md)
- Node — openapi-typescript-codegen: see [`be-node.md`](./be-node.md)

All BE recipes follow the same contract: read the FEAT-scoped OpenAPI YAML, emit
generated code under `apps/api/generated/feat-NNN/` (or per-stack equivalent), commit
the output. CI hashes regenerated output against the committed copy; mismatch fails.

## Done when

- All codegen commands exit 0
- No diff in generated artifacts vs committed copy (FE: `src/api/`, `src/mocks/`; BE: per-stack — see the relevant `be-*.md`)
- Generated artifacts compile / typecheck
