# Provisioner traps — full reference

Verbatim patterns from `daymade/claude-code-skills` (MIT, © 2025 daymade). Loaded on demand from the parent skill.

## `docker: not found` in remote-exec

Cloud-init still installing Docker when provisioner SSHs in.

```hcl
provisioner "remote-exec" {
  inline = [
    "cloud-init status --wait || true",
    "which docker || { echo 'FATAL: Docker not ready'; exit 1; }",
  ]
}
```

## `rsync: connection unexpectedly closed` in local-exec

Terraform holds its SSH connection open; local-exec rsync opens a second one that gets rejected. Never use local-exec for file transfer to remote. Use tarball + file provisioner:

```hcl
provisioner "local-exec" {
  command = "tar czf /tmp/src.tar.gz --exclude=node_modules --exclude=.git -C ${path.module}/../../.. myproject"
}
provisioner "file" {
  source      = "/tmp/src.tar.gz"
  destination = "/tmp/src.tar.gz"
}
provisioner "remote-exec" {
  inline = ["tar xzf /tmp/src.tar.gz -C /data/ && rm -f /tmp/src.tar.gz"]
}
```

macOS BSD tar: `--exclude` must come BEFORE the source argument.

## `cloud-init status` shows "running" forever

`apt-get -y` does not suppress debconf dialogs. Packages like `iptables-persistent` block on TTY prompts.

```yaml
- |
    echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections
    echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections
    DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
```

Known offenders: `iptables-persistent`, `postfix`, `mysql-server`, `wireshark-common`.

## `EACCES: permission denied` in container logs, container Restarting

Host volume dirs are root-owned; container runs as non-root (uid 1001). Fix before `docker compose up`:

```bash
mkdir -p /data/myapp/data /data/myapp/logs
chown -R 1001:1001 /data/myapp/data /data/myapp/logs
```

Find UID: grep `adduser.*-u` or `USER` in Dockerfile.

## Provisioner fails but no diagnostic output

`set -e` exits on first error, hiding subsequent `docker logs` output. Use `set -u` without `-e`, put one verification gate at the end:

```hcl
provisioner "remote-exec" {
  inline = [
    "set -u",
    "docker compose up -d",
    "sleep 15",
    "docker logs myapp --tail 20 2>&1 || true",
    "docker ps --format 'table {{.Names}}\\t{{.Status}}' || true",
    "docker ps --filter name=myapp --format '{{.Status}}' | grep -q healthy || exit 1",
  ]
}
```

## Container `Restarting` — database tables missing

DB migrations not in provisioner. PostgreSQL `docker-entrypoint-initdb.d` only runs on empty data dir. Explicitly create DB + run migrations:

```bash
# After postgres healthy:
docker exec pg psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='mydb'" | grep -q 1 \
  || docker exec pg psql -U postgres -c "CREATE DATABASE mydb;"

# Idempotent migrations:
for f in migrations/*.sql; do
  VER=$(basename $f)
  APPLIED=$($PSQL -tAc "SELECT 1 FROM schema_migrations WHERE version='$VER'" | tr -d ' ')
  [ "$APPLIED" = "1" ] && continue
  { echo 'BEGIN;'; cat $f; echo 'COMMIT;'; } | $PSQL
  $PSQL -tAc "INSERT INTO schema_migrations(version) VALUES ('$VER') ON CONFLICT DO NOTHING"
done
```

## `docker compose build` ignores env var override

Compose reads build args from `.env` file, not shell env. `VAR=x docker compose build` does NOT work.

```bash
# WRONG
DOCKER_WITH_PROXY_MODE=disabled docker compose build

# RIGHT
grep -q DOCKER_WITH_PROXY_MODE .env || echo 'DOCKER_WITH_PROXY_MODE=disabled' >> .env
docker compose build
```

## OAuth login fails: `Social sign in failed`

Casdoor `init_data.json` contains hardcoded redirect URIs. `--createDatabase=true` only applies init_data on first-ever DB creation — not on restarts. Fix via SQL in provisioner:

```bash
$PSQL -c "UPDATE application SET redirect_uris = REPLACE(redirect_uris,
  'gpt-6.pro', 'staging.gpt-6.pro')
  WHERE name='lobechat'
  AND redirect_uris LIKE '%gpt-6.pro%'
  AND redirect_uris NOT LIKE '%staging.gpt-6.pro%';"
```

Also check `AUTH_CASDOOR_ISSUER` — it must match the Casdoor subdomain (`auth.staging.example.com`), not the app root domain.
