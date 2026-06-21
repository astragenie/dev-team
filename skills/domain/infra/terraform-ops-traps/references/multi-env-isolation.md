# Multi-environment isolation — full reference

Verbatim patterns from `daymade/claude-code-skills` (MIT, © 2025 daymade). Loaded on demand from the parent skill.

Before creating a second environment, grep `.tf` files for hardcoded names.

## Globally-unique resources (will fail on apply)

| Resource | Scope | Fix |
|---|---|---|
| SSH key pair | Region | `"${env}-deploy"` |
| SLS log project | Account | `"${env}-logs"` |
| CloudMonitor contact | Account | `"${env}-ops"` |
| Object storage bucket | Global (in most clouds) | `"${env}-${project}-assets"` |
| DNS A record (same name, same zone) | Zone | Subdomain prefix or separate zone |

## DNS duplication trap

Two environments creating A records for the same name in the same Cloudflare zone → two independent record IDs → DNS round-robin → ~50% traffic to wrong instance.

Fix: use subdomain isolation (`staging.example.com`) or separate zones. Remember to create DNS records for ALL subdomains Caddy serves (e.g., `auth.staging`, `minio.staging`).

## Snapshot cross-contamination

Unfiltered `data "alicloud_ecs_snapshots"` returns ALL account snapshots. New env inherits old 100GB snapshot, fails creating 40GB disk. Gate with variable:

```hcl
locals {
  latest_snapshot_id = var.enable_snapshot_recovery && length(local.available_snapshots) > 0
    ? local.available_snapshots[0].snapshot_id : null
}
```

Do NOT add `count` to the data source — changes its state address, causes drift.

## Domain parameterization checklist

Every domain reference in `Caddyfile`, `compose.yaml`, `init_data.json`, `.env`, or any provisioner script must be a variable:

- Caddyfile: `{$VAR}` — Caddy evaluates env vars at startup.
- Compose: `${VAR:?required}` — fails fast if unset.
- App env vars: `${VAR:?required}` in compose `environment:` block.

Grep before merge:

```bash
grep -rE 'https?://[a-z0-9.-]+\.(com|io|pro|net|org)' \
  --include='*.tf' --include='*.yaml' --include='*.yml' \
  --include='*.caddyfile' --include='*.json' \
  . | grep -vE '\$\{|\{env\.|\{\$'
```

Any match = hardcoded domain to fix.
