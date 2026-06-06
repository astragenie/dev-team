# BE recipe — Go (oapi-codegen)

Install:

```bash
go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
```

Generate server stubs + types:

```bash
oapi-codegen \
  -config .claude/artifacts/crew/designs/FEAT-NNN-oapi-codegen.yaml \
  .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml > apps/api/generated/feat_nnn.go
```

Where the config file is:

```yaml
package: featnnn
output-options:
  client-type-name: Client
generate:
  models: true
  std-http-server: true
```

Commit `apps/api/generated/feat_nnn.go`. CI hashes regenerated output vs committed.
