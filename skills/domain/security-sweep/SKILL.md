---
name: security-sweep
tier: domain
description: Pre-merge security sweep skill for automated secrets scanning and supply-chain CVE auditing. Auto-fires on dependency/lockfile diffs and auth-touching diffs. Emits severity-tiered findings as [SEVERITY] file:line blocks and one grep-able observability line per scan.
owner: hero-crew
last_reviewed: 2026-06-13
triggers: secrets, supply chain, dependency audit, lockfile, bun audit, pip-audit, cargo audit, govulncheck, dependency confusion, typosquatting, auth, login, token, credential
---

# Security Sweep

## When to use

Auto-load on any of these diff signals (per `docs/routing-table.md`):

- **Dependency / lockfile change** — diff touches `package.json`, `bun.lock`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or `*.csproj`.
- **Auth-touching diff** — diff touches files matching `(auth|login|signin|signup|jwt|oauth|session|token|password|crypto|secret|credential)` or paths under `*/auth/*` or `*/security/*`.
- **CI-workflow change** — diff touches `.github/workflows/*.yml`; install scripts or hooks may introduce supply-chain vectors.

Also available for explicit invocation: when a reviewer suspects a secrets leak or wants a CVE audit outside the auto-fire triggers.

## Secrets scan procedure

Canonical entry: `bun skills/domain/security-sweep/scripts/scan.ts --diff-base "$SLICE_BASE" [--target <path>]`

Pattern set applied to each line of `git diff --name-only "$SLICE_BASE"` diff content:

| Pattern category      | Regex (applied to file content)                                                              |
| --------------------- | -------------------------------------------------------------------------------------------- |
| AWS key               | `AKIA[0-9A-Z]{16}`                                                                           |
| Generic API key       | `(api[_-]?key\|api[_-]?secret)\s*=\s*['"][^'"]{8,}`                                         |
| Database URL / cred   | `(DATABASE_URL\|DB_PASSWORD\|PGPASSWORD)\s*=\s*['"][^'"]{4,}`                               |
| Generic token         | `(token\|secret\|password\|credential)\s*=\s*['"][^'"]{8,}`                                 |
| Private key header    | `-----BEGIN (RSA\|EC\|OPENSSH\|PGP) PRIVATE KEY`                                            |
| Config leak           | `(PRIVATE_KEY\|CLIENT_SECRET\|AUTH_TOKEN)\s*=\s*['"][^'"]{8,}`                              |

For each match, emit to stdout:

```
[SEVERITY] file:line — short description
Risk: what leaks or breaks
Fix: concrete remediation step
```

Flag only **new** secrets (lines added in the diff, not pre-existing). Fall back to `HEAD~1` when `$SLICE_BASE` is unset.

## Supply-chain audit procedure

Detect ecosystem from changed manifest paths. For each present ecosystem:

| Manifest file                       | Audit command                                      |
| ----------------------------------- | -------------------------------------------------- |
| `package.json` / `bun.lock`         | `bun audit`                                        |
| `requirements.txt` / `pyproject.toml` | `pip-audit`                                      |
| `Cargo.toml`                        | `cargo audit`                                      |
| `go.mod`                            | `govulncheck ./...`                                |
| `*.csproj`                          | `dotnet list package --vulnerable`                 |

Additional checks per ecosystem:

- **Lockfile integrity**: verify lockfile is committed and matches the manifest (no floating ranges without a lock entry).
- **Install-script / lifecycle hook scan**: flag any `preinstall`, `postinstall`, or `prepare` scripts referencing external URLs or piped-shell patterns.
- **Typosquatting / dependency-confusion**: flag packages whose names differ from well-known counterparts by ≤1 character (e.g. `lodahs` vs `lodash`), or whose registry source is `file:` / `git+https:` pointing outside the org.

## Severity tiering

- **CRITICAL** — Active credential leak (committed secret matching the pattern set); RCE-capable CVE (CVSS ≥ 9.0); install-hook pointing to attacker-controlled host.
- **HIGH** — High-severity CVE (CVSS 7.0–8.9); lockfile drift on a direct dependency; dependency-confusion package in scope.
- **MEDIUM** — Medium-severity CVE (CVSS 4.0–6.9) on a transitive dependency; license drift (non-permissive license added without review); typosquatting candidate flagged but unconfirmed.
- **LOW** — Low-severity advisory (CVSS < 4.0); outdated package without a known CVE; informational supply-chain note.

## Remediation commands

One ecosystem-native command per finding:

| Ecosystem  | Remediation command                                        |
| ---------- | ---------------------------------------------------------- |
| bun        | `bun update <pkg>@<safe-version>`                          |
| pip        | `pip install --upgrade <pkg>==<safe-version>`              |
| cargo      | `cargo update -p <pkg>`                                    |
| go         | `go get <module>@<safe-version> && go mod tidy`            |
| dotnet     | `dotnet add package <pkg> --version <safe-version>`        |

For secrets: rotate the credential immediately, then remove from git history with `git filter-repo --path <file> --invert-paths` and force-push under change-control.

## Observability emit

Exactly **one** stderr line per scan invocation, emitted at scan end:

```
SECURITY-SWEEP scan complete: <N> findings (C=<n> H=<n> M=<n> L=<n>)
```

- `N` = total findings count.
- `C` / `H` / `M` / `L` = counts by CRITICAL / HIGH / MEDIUM / LOW.
- No JSON, no ULID, no timestamps — single grep-able line only (FEAT-141 reserved for structured log pipeline).

Example: `SECURITY-SWEEP scan complete: 3 findings (C=1 H=1 M=1 L=0)`

## Done / Acceptance

Exit conditions for a sweep-clean result:

- Zero `CRITICAL` findings unmerged. Any CRITICAL finding blocks merge until the credential is rotated and removed from history, or the CVE is patched.
- Every `HIGH` finding is either fixed (package updated, lockfile re-committed) or carries an accepted-risk note in the review-result `--risks` field with owner and TTL.
- The observability stderr line was emitted exactly once per scan invocation and is grep-able in the review log.
- `bun audit` (or ecosystem equivalent) exits 0, or all non-zero findings are documented in `--risks`.
