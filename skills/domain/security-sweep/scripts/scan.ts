#!/usr/bin/env bun
/**
 * Security sweep scan script — canonical entry for skills/domain/security-sweep/SKILL.md
 * Usage: bun scan.ts --diff-base <ref> [--target <path>]
 * Exit: 0=no CRITICAL, 1=CRITICAL found, 2=scan failed
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types + constants
// ---------------------------------------------------------------------------

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type Ecosystem = "bun" | "pip" | "cargo" | "go" | "dotnet";

interface Finding {
  severity: Severity;
  file: string;
  line: number;
  description: string;
  risk: string;
  fix: string;
}

const SECRET_PATTERNS: Array<{ label: string; re: RegExp; sev: Severity }> = [
  { label: "AWS key", re: /AKIA[0-9A-Z]{16}/, sev: "CRITICAL" },
  { label: "Private key header", re: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY/, sev: "CRITICAL" },
  { label: "API key/secret", re: /(api[_-]?key|api[_-]?secret)\s*=\s*['"][^'"]{8,}/i, sev: "HIGH" },
  { label: "DB credential", re: /(DATABASE_URL|DB_PASSWORD|PGPASSWORD)\s*=\s*['"][^'"]{4,}/i, sev: "HIGH" },
  { label: "Token/secret/password", re: /(token|secret|password|credential)\s*=\s*['"][^'"]{8,}/i, sev: "HIGH" },
  { label: "Config secret", re: /(PRIVATE_KEY|CLIENT_SECRET|AUTH_TOKEN)\s*=\s*['"][^'"]{8,}/i, sev: "HIGH" },
];

const ECOSYSTEM_MANIFESTS: Array<{ eco: Ecosystem; match: (f: string) => boolean }> = [
  { eco: "bun", match: (f) => f === "package.json" || f === "bun.lock" },
  { eco: "pip", match: (f) => f === "requirements.txt" || f === "pyproject.toml" },
  { eco: "cargo", match: (f) => f === "Cargo.toml" },
  { eco: "go", match: (f) => f === "go.mod" },
  { eco: "dotnet", match: (f) => f.endsWith(".csproj") },
];

const ECOSYSTEM_AUDIT: Record<Ecosystem, string> = {
  bun: "bun audit 2>&1 || true",
  pip: "pip-audit 2>&1 || true",
  cargo: "cargo audit 2>&1 || true",
  go: "govulncheck ./... 2>&1 || true",
  dotnet: "dotnet list package --vulnerable 2>&1 || true",
};

const ECOSYSTEM_FIX: Record<Ecosystem, string> = {
  bun: "bun update <pkg>@<safe-version>",
  pip: "pip install --upgrade <pkg>==<safe-version>",
  cargo: "cargo update -p <pkg>",
  go: "go get <module>@<safe-version> && go mod tidy",
  dotnet: "dotnet add package <pkg> --version <safe-version>",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shell(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (err) {
    const stdout = (err !== null && typeof err === 'object' && 'stdout' in err && typeof (err as Record<string, unknown>).stdout === 'string')
      ? (err as { stdout: string }).stdout
      : "";
    return stdout;
  }
}

function parseArgs(argv: string[]): { diffBase: string; target: string } {
  let diffBase = "HEAD~1";
  let target = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--diff-base") { const val = argv[i + 1]; if (val) { diffBase = val; i++; } }
    else if (argv[i] === "--target") { const val = argv[i + 1]; if (val) { target = val; i++; } }
  }
  return { diffBase, target };
}

// ---------------------------------------------------------------------------
// Scan logic
// ---------------------------------------------------------------------------

function changedFiles(diffBase: string, cwd: string): string[] {
  return shell(`git diff --name-only ${diffBase}`, cwd)
    .split("\n").map((l) => l.trim()).filter(Boolean);
}

function scanSecrets(files: string[], cwd: string): Finding[] {
  const out: Finding[] = [];
  for (const rel of files) {
    const abs = path.join(cwd, rel);
    if (!fs.existsSync(abs)) continue;
    let content: string;
    try { content = fs.readFileSync(abs, "utf8"); } catch { continue; }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const txt = lines[i] ?? "";
      for (const { label, re, sev } of SECRET_PATTERNS) {
        if (re.test(txt)) {
          out.push({
            severity: sev, file: rel, line: i + 1,
            description: `${label} detected`,
            risk: sev === "CRITICAL" ? "Active credential leak; rotate immediately" : "Potential secret in diff",
            fix: sev === "CRITICAL"
              ? "Rotate credential; scrub history: git filter-repo --path <file> --invert-paths"
              : "Move to environment variable or secrets manager",
          });
          break;
        }
      }
    }
  }
  return out;
}

function detectEcosystems(files: string[], cwd: string): Ecosystem[] {
  const found = new Set<Ecosystem>();
  const allNames = [...files, ...fs.readdirSync(cwd)].map((f) => path.basename(f));
  for (const name of allNames) {
    for (const { eco, match } of ECOSYSTEM_MANIFESTS) {
      if (match(name)) found.add(eco);
    }
  }
  return [...found];
}

function auditEcosystem(eco: Ecosystem, cwd: string): Finding[] {
  const out = shell(ECOSYSTEM_AUDIT[eco], cwd).toLowerCase();
  const hasVulns = out.includes("vulnerabilit") || out.includes("advisory") || out.includes("critical") || out.includes("high");
  if (!hasVulns) return [];
  return [{
    severity: "HIGH", file: `${eco}-audit`, line: 0,
    description: `${eco} audit reported vulnerabilities`,
    risk: "Vulnerable dependency may expose the application to known CVEs",
    fix: ECOSYSTEM_FIX[eco] ?? "Run ecosystem audit and apply recommended updates",
  }];
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function emitFindings(findings: Finding[]): void {
  for (const f of findings) {
    const loc = f.line > 0 ? `${f.file}:${f.line}` : f.file;
    process.stdout.write(`[${f.severity}] ${loc} — ${f.description}\nRisk: ${f.risk}\nFix: ${f.fix}\n\n`);
  }
}

function emitObsLine(findings: Finding[]): void {
  const count = (sev: Severity): number => findings.filter((f) => f.severity === sev).length;
  process.stderr.write(
    `SECURITY-SWEEP scan complete: ${findings.length} findings (C=${count("CRITICAL")} H=${count("HIGH")} M=${count("MEDIUM")} L=${count("LOW")})\n`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { diffBase, target } = parseArgs(process.argv.slice(2));

  let files: string[];
  try {
    files = changedFiles(diffBase, target);
  } catch (err) {
    process.stderr.write(`SECURITY-SWEEP scan failed: ${String(err)}\n`);
    process.exitCode = 2;
    return;
  }

  const findings: Finding[] = [
    ...scanSecrets(files, target),
    ...detectEcosystems(files, target).flatMap((eco) => auditEcosystem(eco, target)),
  ];

  emitFindings(findings);
  emitObsLine(findings);

  process.exitCode = findings.some((f) => f.severity === "CRITICAL") ? 1 : 0;
}

await main().catch((err) => {
  process.stderr.write(`SECURITY-SWEEP scan failed: ${String(err)}\n`);
  process.exitCode = 2;
});
