---
name: terraform-ops-traps
tier: domain
description: Operational failure patterns for Terraform provisioners, multi-env isolation, and zero-to-deployment reliability. Activate when writing null_resource provisioners, debugging containers Restarting/unhealthy after apply, setting up fresh instances with cloud-init, hitting TLS/ACME errors, or any IaC code that SSHs into remote hosts.
owner: astra
last_reviewed: 2026-05-23
triggers: ["terraform", "provisioner", "remote-exec", "local-exec", "cloud-init", "null_resource", "tflint", "checkov", "tls handshake", "caddy", "docker compose"]
---

# Terraform Operational Traps

Real-incident failure patterns. Each entry: **exact error → root cause → copy-paste fix**.

## When to Use

- `null_resource` + `remote-exec` work that SSHs into provisioned hosts.
- Containers `Restarting` / `unhealthy` after `terraform apply`.
- Fresh instances bootstrapping via cloud-init.
- TLS/ACME failures from Caddy or other gateways.
- Setting up a second environment (staging) from a working one (prod).

For deeper material see the `references/` directory:

- [provisioner-traps.md](references/provisioner-traps.md) — every provisioner anti-pattern with full HCL.
- [multi-env-isolation.md](references/multi-env-isolation.md) — globally-unique resource matrix; DNS / snapshot cross-contamination.
- [zero-to-deploy.md](references/zero-to-deploy.md) — fresh-disk checklist; implicit dependencies that always bite.

## Top patterns (full HCL in references)

### Provisioner timing — `docker: not found` in remote-exec

Cloud-init still installing Docker when provisioner SSHs in. Gate every remote-exec with cloud-init wait + binary check:

```hcl
provisioner "remote-exec" {
  inline = [
    "cloud-init status --wait || true",
    "which docker || { echo 'FATAL: Docker not ready'; exit 1; }",
  ]
}
```

### File transfer — never `local-exec rsync` to remote

Terraform holds the SSH connection; local-exec opens a second one that gets rejected. Use tarball + `file` provisioner. See `references/provisioner-traps.md` for the 3-step pattern.

### Cloud-init hangs — interactive package prompts

`apt-get -y` does **not** suppress debconf TTY prompts. Known offenders: `iptables-persistent`, `postfix`, `mysql-server`. Pre-seed debconf:

```yaml
- |
    echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections
    DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
```

### Volume permission `EACCES` — container Restarting

Host volume dirs are root-owned; container runs as non-root (uid 1001). Fix before `docker compose up`:

```bash
mkdir -p /data/app/{data,logs}
chown -R 1001:1001 /data/app/{data,logs}
```

Find UID: grep `USER` or `adduser.*-u` in the Dockerfile.

### TLS handshake — `Invalid format for Authorization header`

Caddy DNS-01 ACME needs a Cloudflare **API Token** (`cfut_` prefix, Bearer auth). A **Global API Key** (37 hex chars, X-Auth-Key auth) returns HTTP 400 Code:6003. Production may appear to work via cached certs; fresh envs fail on first cert request. Verify before deploy:

```bash
TOKEN=$(grep CLOUDFLARE_API_TOKEN .env | cut -d= -f2)
echo "$TOKEN" | grep -q "^cfut_" || echo "FATAL: needs API Token, not Global Key"
```

### TLS fails on staging but works on production — hardcoded domains

Caddyfile or compose has literal domain names. Staging loads production config and tries to mint certs for domains it doesn't own. Use `{$VAR}` in Caddyfile and `${VAR:?required}` in compose for fail-fast:

```caddy
{$APP_DOMAIN} { tls { dns cloudflare {env.CLOUDFLARE_API_TOKEN} } }
```

```yaml
- APP_URL=${APP_URL:?APP_URL is required}
```

### Multi-env duplication — globally unique resources

These will **fail on apply** if a second env reuses the name:

| Resource | Scope | Fix |
|---|---|---|
| SSH key pair | Region | `"${env}-deploy"` |
| Log project (SLS) | Account | `"${env}-logs"` |
| CloudMonitor contact | Account | `"${env}-ops"` |

DNS duplication: two envs creating A records for the same name in the same zone → round-robin → ~50% traffic to wrong instance. Use subdomain isolation (`staging.example.com`) or separate zones.

### Snapshot cross-contamination

Unfiltered `data "alicloud_ecs_snapshots"` returns ALL account snapshots — new env inherits old instance's 100GB snapshot, fails creating 40GB disk. Gate with variable:

```hcl
locals {
  latest_snapshot_id = var.enable_snapshot_recovery && length(local.available_snapshots) > 0
    ? local.available_snapshots[0].snapshot_id : null
}
```

Do **not** add `count` to the data source — changes its state address, causes drift.

## Pre-deploy validation gate

Run a validator script before `terraform apply` to catch config errors locally. Eliminates the deploy→discover→fix→redeploy cycle. Minimum checks:

1. `terraform validate` — syntax.
2. No hardcoded domains in Caddyfile / compose.
3. Required env vars present.
4. Cloudflare API Token format (`cfut_` prefix).
5. DNS records exist for all Caddy-served domains.
6. SSH private key file exists.

Wire as `make pre-deploy ENV=staging` before `make apply`.

## Done / Stop-when

- Diff under review uses none of the listed anti-patterns OR remediates each with the referenced fix.
- For multi-env work: globally-unique resources scoped with `${env}-` prefix; DNS records subdomain-isolated.
- Pre-deploy validator passes (or its absence is recorded as a known gap with a follow-up issue).

## Attribution

Adapted from [daymade/claude-code-skills](https://github.com/daymade/claude-code-skills) — `terraform-skill` (MIT, © 2025 daymade). Trimmed to ≤200 lines and split into `references/` per this repo's skill quality bar. Original verbatim content preserved in references where copied.
