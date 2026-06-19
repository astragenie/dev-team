#!/usr/bin/env node
/**
 * Langfuse self-host bootstrapper for FEAT-165 SLICE-B.
 *
 * Usage: node ./scripts/setup-langfuse-self-host.ts [--out <path>]
 *
 * Writes a docker-compose.yml snippet for local Langfuse + Postgres,
 * then prints step-by-step instructions for the two-key OTel opt-in.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DOCKER_COMPOSE_CONTENT = `services:
  langfuse-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: langfuse
      POSTGRES_PASSWORD: langfuse_secret
      POSTGRES_DB: langfuse
    volumes:
      - langfuse_pg_data:/var/lib/postgresql/data

  langfuse:
    image: langfuse/langfuse:latest
    depends_on:
      - langfuse-db
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://langfuse:langfuse_secret@langfuse-db:5432/langfuse
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: dev_nextauth_secret_change_me
      SALT: dev_salt_change_me
      TELEMETRY_ENABLED: "false"
      LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES: "false"

volumes:
  langfuse_pg_data:
`;

async function main(): Promise<void> {
  // Parse --out flag
  let outPath = path.join(process.cwd(), "langfuse", "docker-compose.yml");
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) {
      outPath = path.resolve(args[i + 1] as string);
      i++;
    }
  }

  // Ensure parent dir exists
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, DOCKER_COMPOSE_CONTENT, "utf8");

  const relPath = path.relative(process.cwd(), outPath);

  console.log("Langfuse self-host setup");
  console.log("========================");
  console.log("");
  console.log(`Written: ${outPath}`);
  console.log("");
  console.log("Step 1 — Start Langfuse");
  console.log(`  docker compose -f ${relPath} up -d`);
  console.log("");
  console.log("Step 2 — First run");
  console.log("  Open: http://localhost:3000");
  console.log("  Create an account, then create a project named 'crew-plugin'.");
  console.log("  Go to Settings > API Keys and create a key pair (pk-lf-... / sk-lf-...).");
  console.log("");
  console.log("Step 3 — Export auth env var");
  console.log("  export LANGFUSE_AUTH_B64=$(echo -n 'pk-lf-YOUR_KEY:sk-lf-YOUR_SECRET' | base64)");
  console.log("  export CREW_OTEL_ENABLED=1");
  console.log("");
  console.log("Step 4 — Enable in config");
  const exampleYaml = path.join(".claude", "crew", "telemetry.example.yaml");
  const targetYaml = path.join(".claude", "crew", "telemetry.yaml");
  console.log(`  cp ${exampleYaml} ${targetYaml}`);
  console.log(`  # Edit ${targetYaml} — set enabled: true`);
  console.log("");
  console.log("Step 5 — Verify");
  console.log("  grep '^enabled:' .claude/crew/telemetry.yaml   # must print: enabled: true");
  console.log('  echo "$CREW_OTEL_ENABLED"                      # must print: 1');
  console.log("");
  console.log("  Open a fresh Claude Code session, run any tool call, then close.");
  console.log("  Within 30s traces should appear at http://localhost:3000");
  console.log("  under project 'crew-plugin' with span name 'tool_call'.");
}

main().catch((err: unknown) => {
  process.stderr.write(`setup-langfuse-self-host: ${String(err)}\n`);
});
