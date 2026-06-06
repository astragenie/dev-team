# Codegen-tool selection per consumer repo

Each consumer repo declares its codegen tool per stack in `.claude/loop.json`:

```json
{
  "stack": {
    "codegen": {
      "be": {
        "csharp": "nswag",
        "python": "datamodel-code-generator+fastapi-code-generator",
        "go": "oapi-codegen",
        "node": "openapi-typescript-codegen"
      },
      "fe": {
        "client": "orval",
        "mocks": "openapi-msw"
      }
    }
  }
}
```

Builder reads this config in its first step. Missing entry for the FEAT's stack →
`mark-badge help_request --note "codegen tool not declared for stack:<X>"`.
