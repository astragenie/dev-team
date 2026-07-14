// scripts/lib/memory/inject-profile.ts — FEAT (agent-profile load). Sibling of
// inject-recall.ts. Formats the agent's astramem profile into a
// `## Your track record (<agent>)` block. Corrections lead (deterministic,
// day-one value), then recent decisions, then top lessons. Each line carries
// its atom id in an HTML-comment marker so the feedback step can attribute use.
// Fail-silent + byte-identical-when-disabled is enforced in buildProfileBlock
// (Task 3); this module is a pure formatter.
import type { AgentProfile } from "./profile-types.ts";

/** Trailing marker carrying an atom id — invisible in rendered Markdown,
 *  machine-readable by the feedback step (Task 5). */
export function atomMarker(id: string): string {
  return ` <!--atom:${id}-->`;
}

export interface FormatProfileOptions {
  agent: string;
  /** Hard character budget (shared sub-allocation, ~4 chars/token). */
  maxChars: number;
  /** True once enough atoms carry a real usefulness signal; false => lessons
   *  are labelled importance-ranked to avoid implying a dead ranking is meaningful. */
  usefulnessWarm: boolean;
}

export function formatProfileBlock(profile: AgentProfile, opts: FormatProfileOptions): string {
  const lines: string[] = [];
  for (const c of profile.corrections) {
    lines.push(`- **[correction ${c.action}]** ${c.text}${atomMarker(c.id)}`);
  }
  for (const d of profile.recent_decisions) {
    lines.push(`- **[decision]** ${d.text}${atomMarker(d.id)}`);
  }
  const lessonLabel = opts.usefulnessWarm ? "lesson" : "lesson · importance-ranked";
  for (const l of profile.top_lessons) {
    lines.push(`- **[${lessonLabel}]** ${l.text}${atomMarker(l.id)}`);
  }
  if (lines.length === 0) return "";

  const header = `## Your track record (${opts.agent})`;
  let block = `${header}\n${lines.join("\n")}`;
  if (block.length > opts.maxChars) {
    // Deterministic truncation: keep the header + as many leading lines
    // (corrections first) as fit. Never split a line.
    const kept: string[] = [];
    let used = header.length;
    for (const line of lines) {
      if (used + 1 + line.length > opts.maxChars) break;
      kept.push(line);
      used += 1 + line.length;
    }
    block = kept.length === 0 ? header.slice(0, opts.maxChars) : `${header}\n${kept.join("\n")}`;
  }
  return block;
}
