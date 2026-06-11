// scripts/lib/installer/bun-preflight.ts
import { spawnSync } from "node:child_process";

export interface BunPresentResult {
  readonly version: string;
}

export interface BunPreflightOptions {
  readonly env?: NodeJS.ProcessEnv;
}

const INSTALL_URL = "https://bun.sh";
const MIN_MAJOR = 1;
const MIN_MINOR = 3;

export function assertBunPresent(opts: BunPreflightOptions = {}): BunPresentResult {
  const env = opts.env ?? process.env;
  const res = spawnSync("bun", ["--version"], { env, encoding: "utf8" });
  if (res.error || res.status !== 0) {
    throw new Error(
      `crew install requires Bun >= ${MIN_MAJOR}.${MIN_MINOR}. ` +
        `Install from ${INSTALL_URL} and re-run.`
    );
  }
  const version = (res.stdout ?? "").trim();
  const m = version.match(/^(\d+)\.(\d+)/);
  if (!m) {
    throw new Error(
      `Could not parse "bun --version" output: ${JSON.stringify(version)}. ` +
        `Install from ${INSTALL_URL}.`
    );
  }
  const major = Number.parseInt(m[1]!, 10);
  const minor = Number.parseInt(m[2]!, 10);
  if (major < MIN_MAJOR || (major === MIN_MAJOR && minor < MIN_MINOR)) {
    throw new Error(
      `crew install requires Bun >= ${MIN_MAJOR}.${MIN_MINOR}; detected ${version}. ` +
        `Upgrade from ${INSTALL_URL}.`
    );
  }
  return { version };
}
