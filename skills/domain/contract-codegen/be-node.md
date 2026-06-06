# BE recipe — Node (openapi-typescript-codegen)

Install:

```bash
npm install --save-dev openapi-typescript-codegen
```

Generate:

```bash
npx openapi-typescript-codegen \
  --input .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  --output apps/api/generated/feat-nnn/ \
  --client fetch
```

Commit `apps/api/generated/feat-nnn/`. CI hashes regenerated output vs committed.
