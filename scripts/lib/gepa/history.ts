import { join } from "node:path";
import { fileStore } from "@astragenie/gepa-core";

export interface HistoryResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runGepaHistoryCmd(
  repoPath: string,
  args: string[],
): Promise<HistoryResult> {
  const agent = args[0];
  if (!agent || agent.startsWith("--")) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "usage: gepa-history <agent> [--source eval|captured|soak] [--limit N]\n",
    };
  }

  let source: "eval" | "captured" | "soak" | undefined;
  let limit = 10;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      source = args[i + 1] as typeof source;
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = Number.parseInt(args[i + 1]!, 10);
      if (Number.isNaN(limit) || limit <= 0) {
        return { exitCode: 2, stdout: "", stderr: "invalid --limit\n" };
      }
      i++;
    }
  }

  const storeRoot = join(repoPath, ".claude/artifacts/crew/gepa/trials");
  const store = fileStore(storeRoot);
  const trials = await store.recall({
    agent,
    limit,
    ...(source !== undefined ? { source } : {}),
  });

  const rows = trials.map((t) =>
    [
      t.id,
      t.source,
      String(t.score.pass),
      t.score.score.toFixed(3),
      t.score.cost_usd.toFixed(4),
      String(t.score.latency_ms),
      t.created_at,
    ].join(" | "),
  );

  return { exitCode: 0, stdout: `${rows.join("\n")}\n`, stderr: "" };
}
