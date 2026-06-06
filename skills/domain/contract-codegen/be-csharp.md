# BE recipe — C# / .NET

Two supported tools: **NSwag** (default) or **Kiota** (alternative). Pick ONE per FEAT
(declare in `.claude/loop.json` `stack.codegen.be.csharp`). Don't mix.

## NSwag

Install (dev):

```bash
dotnet tool install -g NSwag.ConsoleCore
```

Generate DTOs + server interface:

```bash
nswag openapi2cscontroller \
  /input:.claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  /output:apps/api/Generated/FeatNNN.cs \
  /namespace:Api.Generated.FeatNNN \
  /controllerStyle:partial
```

Commit `apps/api/Generated/FeatNNN.cs`. CI hashes regenerated output vs committed.

## Kiota (alternative)

```bash
kiota generate \
  --openapi .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  --language CSharp \
  --output apps/api/Generated/FeatNNN \
  --namespace-name Api.Generated.FeatNNN
```
