# BE recipe — Python (datamodel-code-generator + fastapi-code-generator)

Install:

```bash
pip install datamodel-code-generator fastapi-code-generator
```

Generate Pydantic models:

```bash
datamodel-codegen \
  --input .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  --output apps/api/generated/feat_nnn/models.py \
  --input-file-type openapi \
  --output-model-type pydantic_v2.BaseModel
```

Generate FastAPI route stubs:

```bash
fastapi-codegen \
  --input .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  --output apps/api/generated/feat_nnn/
```

Commit `apps/api/generated/feat_nnn/`. CI hashes regenerated output vs committed.
