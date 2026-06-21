# Zero-to-deployment checklist — full reference

Verbatim patterns from `daymade/claude-code-skills` (MIT, © 2025 daymade). Loaded on demand from the parent skill.

Fresh disks expose every implicit dependency.

## Items that break provisioners on fresh instances

1. **Directories**: `mkdir -p /data/{svc1,svc2}` in cloud-init — `file` provisioner fails if target dir missing.
2. **Databases**: Explicit `CREATE DATABASE` — PG init scripts only run on empty data dir.
3. **Migrations**: Tracked in `schema_migrations` table, applied idempotently.
4. **Provisioner ordering**: `depends_on` between resources sharing Docker networks.
5. **Memory**: Stop non-critical containers during Docker build on small instances (≤8GB).
6. **Domain parameterization**: Every domain in Caddyfile/compose must be `{$VAR}` / `${VAR:?required}`.
7. **Credential format**: Caddy needs Cloudflare API Token (`cfut_` prefix), not Global API Key.

## Pre-deploy validation script template

```bash
#!/usr/bin/env bash
# pre-deploy.sh — run before `terraform apply` on a fresh environment.
set -euo pipefail

ENV="${1:-staging}"
ENV_DIR="environments/${ENV}"

echo "[1/7] terraform validate"
terraform -chdir="$ENV_DIR" validate

echo "[2/7] no hardcoded domains in Caddyfile/compose"
! grep -rE 'https?://[a-z0-9.-]+\.(com|io|pro|net|org)' \
  --include='*.caddyfile' --include='*.yaml' --include='*.yml' \
  "$ENV_DIR" | grep -vE '\$\{|\{env\.|\{\$' || {
    echo "FATAL: hardcoded domain found"; exit 1;
  }

echo "[3/7] required env vars"
for v in APP_URL APP_DOMAIN CLOUDFLARE_API_TOKEN; do
  grep -q "^${v}=" "$ENV_DIR/.env" || {
    echo "FATAL: $v missing from $ENV_DIR/.env"; exit 1;
  }
done

echo "[4/7] CF API Token format"
TOKEN=$(grep CLOUDFLARE_API_TOKEN "$ENV_DIR/.env" | cut -d= -f2)
echo "$TOKEN" | grep -q "^cfut_" || {
  echo "FATAL: CLOUDFLARE_API_TOKEN must start with 'cfut_' (API Token, not Global Key)"; exit 1;
}

echo "[5/7] DNS records for Caddy-served domains"
# Implementation depends on DNS provider — sketch:
# for domain in $(grep -oE '\{\$([A-Z_]+_DOMAIN)\}' "$ENV_DIR/Caddyfile" | tr -d '{}$'); do
#   dig +short "${!domain}" | grep -q . || { echo "FATAL: no A record for $domain"; exit 1; }
# done

echo "[6/7] Casdoor issuer URL matches auth.* subdomain"
# Check init_data.json or runtime config

echo "[7/7] SSH private key exists"
[ -f "$HOME/.ssh/${ENV}_deploy" ] || {
  echo "FATAL: SSH key missing at ~/.ssh/${ENV}_deploy"; exit 1;
}

echo "ALL CHECKS PASSED"
```

Integrate into Makefile:

```makefile
.PHONY: pre-deploy
pre-deploy:
	bash ./pre-deploy.sh $(ENV)

.PHONY: apply
apply: pre-deploy
	terraform -chdir=environments/$(ENV) apply
```

## Memory pressure during build

On small instances (≤8GB), Docker build can OOM-kill other running containers. Stop non-critical containers before build:

```bash
docker stop $(docker ps -q --filter "name=nginx" --filter "name=cache") || true
docker compose build
docker start nginx cache  # restart after
```

## Idempotent provisioners

Every provisioner step must be safe to re-run. Use guards:

```bash
# Create dir if missing
mkdir -p /data/app

# Create DB if missing
docker exec pg psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='app'" \
  | grep -q 1 || docker exec pg psql -U postgres -c "CREATE DATABASE app;"

# Apply schema if marker absent
[ -f /data/app/.migrated ] || {
  docker exec pg psql -U postgres -d app -f /tmp/schema.sql
  touch /data/app/.migrated
}
```

Non-idempotent provisioners drift the second time Terraform re-runs them (state change, manual `taint`, etc.).
