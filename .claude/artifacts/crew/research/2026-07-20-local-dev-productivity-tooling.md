# Local Dev Productivity Tooling for Claude Code — Research Report

**Date:** 2026-07-20
**Scope:** Windows 11 / PowerShell 7 power user, Claude Code CLI on Opus 4.8 (1M ctx), stack = .NET 10 + TS/Bun + React + Python + Terraform + Flutter, Postgres 18 local, Azure AKS/App Service/Container Apps. ~35 plugins already installed, full crew subagent roster in place.
**Method:** Deep-research fan-out (6 search angles) → 26 source batches → 117 extracted claims → 75 adversarial verification passes, killed on 2-of-3 refute. This run was salvaged mid-verification; claims with fewer than 3 verdicts are explicitly marked **[unverified — lower confidence]**. Every tool-state claim below is cited; several original claims were **corrected** during verification (wrong version numbers, an inflated tool count, an unsupported "Windows compatible" quote) — corrections are called out inline, not silently fixed.
**Excluded (already installed, per instructions):** context7, astramem, sonarqube, playwright, northstar MCP; superpowers/crew/runner/github/azure/code-review/coderabbit/pr-review-toolkit/feature-dev/plugin-dev/skill-creator/claude-md-management/session-report/code-simplifier/security-guidance plugins; pyright/csharp/typescript LSPs.

---

## Executive summary (20 lines)

1. **Zero-cost quick win, do today:** `npx ccusage` — local, no-install, actively maintained (v20.0.18, 17.3k★, released same day as this research) CLI for per-session/cache-hit/cost reporting. Pair with the **built-in `/usage` and `/context` commands** (official, already in your CLI) — no third-party tool needed for baseline cost/context visibility.
2. **MCP context bloat is now mostly a solved problem you're already benefiting from:** Tool Search (deferred/lazy MCP tool loading) is Claude Code's **default** behavior today — confirmed by official docs and visible in this very session's deferred-tools list. Old advice ("disable unused MCP servers," experimental CLI-proxy flags) is largely obsolete; the one live exception is `mcp-remote`-proxied servers, which still load eagerly.
3. **Kubernetes:** `containers/kubernetes-mcp-server` (Red Hat-backed, Go-native, Entra ID OAuth support) is the one MCP server in this report worth adopting now, given your AKS work — but it exposes **~49 tools, not the commonly-quoted "60+"** (verified by direct count).
4. **Postgres MCP is a trap right now:** Anthropic's own reference server was archived after it executed `DROP SCHEMA` despite claiming read-only mode. The other popular option (Postgres MCP Pro) has stalled since its acquisition. Use `psql` directly against your local Postgres 18.
5. **Docker and GitHub MCP servers:** not covered by this research pass (no vetted candidate surfaced) — for GitHub, your existing `github` plugin + `gh` CLI already cover it; don't add a redundant server.
6. **Notion/Linear MCP:** only relevant if you actually use those tools (not in your stated stack) — both are ADOPT LATER, conditional.
7. **Knowledge retrieval over your ADRs/specs:** the research strongly converges on **ripgrep-based Skill, not a vector-index MCP server** — this is also what your existing `crew:investigator`/`crew:researcher` agents already do. The gap is a light packaged "search ADRs/specs" skill, not new infrastructure.
8. **Hooks:** the official PostToolUse `Edit|Write` → formatter pattern is real, but on Windows a shell-form hook runs via **Git Bash by default**, not native PowerShell — you must use object-form (`"command": "powershell.exe"`) to invoke PowerShell explicitly. `dotnet format` doesn't cleanly accept a bare file path the way Prettier/Biome/ruff do; use `dotnet format <csproj> --include <file>`.
9. **Full test suites and secret-scanning belong in pre-commit/CI, not per-edit hooks** — hook timeouts default to 10 minutes and an infinite-looping hook freezes the session.
10. **Several "recent changelog" claims in the raw research were version-misattributed** and corrected here: background-subagents-by-default is **v2.1.198** (not v2.1.212); tool-pool-assembly caching (7x faster tool rounds) is **v2.1.208** (not v2.1.214); the MCP approval-gate UI is **v2.1.154** (not v2.1.196, which only patched a bypass).
11. Genuinely new in the last ~3 months worth your attention: skills-stacking fix (multiple skills now fire correctly together, no duplicate-injection on re-trigger) — directly relevant to your 35-plugin setup; `disableBundledSkills` / `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` as a context lever; a 200-subagent-per-session cap (v2.1.212) worth knowing given your peer-dispatch/swarm/wave usage; Windows worktree-removal bug fix (v2.1.205).
12. Claude-Code-Usage-Monitor (uv install, ML-based burn-rate prediction) is solid but its README does **not** actually contain the oft-quoted "Windows (PowerShell compatible)" line — it works on Windows via documented `uv`/pip/pipx steps, just don't cite a marketing line that isn't there. Known open Windows timezone bug (issue #188).
13. `phuryn/claude-usage`: the claim that "Windows-practical paths are only direct-clone or Docker" is **wrong** — the tool's own README labels `uv tool install` / `pipx install` as "Any OS," which includes Windows and is the more practical single-command path.
14. Low-confidence/example numbers not to over-trust: "51K→8.5K tokens, 46.9% reduction" and "67,300 tokens for 7 MCP servers" are single-blog/single-forum-post figures never adversarially re-verified in this run — directionally consistent with the (verified) fact that deferral is now default, but treat the specific numbers as illustrative, not measured-for-you.
15. Ranked adoption list, full detail, and per-question breakdown follow below.

---

## Ranked adoption list

### Tier 0 — zero cost, adopt today

**1. `npx ccusage` (local CLI, token/cost/cache-hit reporting)**
- What: reads local Claude Code JSONL transcripts, computes cost estimates with cache-creation-vs-cache-read accounting, per-session/daily/monthly/5-hour-block breakdowns. Also tracks Codex, OpenCode, Amp, and others if you ever branch out.
- Install: `npx ccusage` (no install step; Windows via Node/npx). Or `npm install -g ccusage`.
- Cost: zero context (it's a terminal tool, not an MCP server or plugin), ~seconds to run.
- Gain: immediate visibility into cache hit rate and per-model spend that `/usage` shows only for the current session.
- **ADOPT NOW.** Actively maintained (v20.0.18, released 2026-07-20 — the day of this research; 17.3k★, 132 releases). One noted Windows install hiccup (`EUNSUPPORTEDPROTOCOL`) tracked at github.com/ccusage/ccusage/issues/864 — not disqualifying.
- Sources: https://ccusage.com/ ; https://github.com/ccusage/ccusage

**2. Built-in `/usage` and `/context` commands**
- What: `/usage` — per-session cost, duration, per-model input/output/cache-read/cache-write token breakdown, computed locally as an estimate. `/context` — shows what's consuming your context window right now (plugins, skills, MCP tool listings).
- Install: nothing — already in your CLI.
- Gain: the fastest way to answer "why is my context 60% full with a 35-plugin setup" — run `/context` before reaching for any third-party dashboard.
- **ADOPT NOW.** Confirmed via official docs, high confidence.
- Source: https://code.claude.com/docs/en/costs

**3. `/mcp` to audit and prune MCP servers per-repo**
- What: shows configured MCP servers; disable ones unused in a given repo.
- Gain: direct mitigation for the context-budget question — but see item below on Tool Search making this less urgent than it used to be.
- **ADOPT NOW** as a periodic habit (e.g., at repo onboarding), not a one-time fix.
- Source: https://code.claude.com/docs/en/costs

**4. Stop chasing manual MCP-context hacks — Tool Search is now default**
- What: MCP tool definitions are deferred by default; only tool *names* enter context at session start, full schemas load only when a tool is actually invoked. This is why your session's deferred-tools list (visible in this very transcript) exists.
- Action: nothing to install. Do **not** adopt the older workarounds still floating around blogs — `claude mcp remove`/`add` per-session cycling, or the experimental `ENABLE_EXPERIMENTAL_MCP_CLI` flag (~32k token reclaim) — both predate default Tool Search and are largely superseded.
- One real exception to know: MCP tools proxied through `mcp-remote` are **not** deferred (tracked at github.com/anthropics/claude-code/issues/25894) — if any of your MCP servers go through that proxy path, they still pay full upfront cost.
- **ADOPT NOW** (already active; just stop doing the manual workaround).
- Sources: https://code.claude.com/docs/en/costs ; https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search ; https://github.com/anthropics/claude-code/issues/25894

**5. Prefer CLI over MCP for gh/kubectl/docker/psql (official guidance, confirmed)**
- What: CLI tools add **zero per-tool context-listing cost** vs. MCP servers, which still list tool names even under deferred loading. Official docs name `gh`, `aws`, `gcloud`, `sentry-cli` explicitly as preferred over MCP equivalents.
- Action: for one-shot/scripted checks (`kubectl get pods`, `docker ps`, `gh pr view`, `psql -c "select..."`), keep using the CLI via Bash. Reserve MCP servers (where you adopt them) for exploratory, multi-step, stateful sessions where the tool's structured output and safety rails (read-only flags, scoped auth) earn their context cost.
- **ADOPT NOW** as your default posture; treated as the tie-breaker for every per-tool verdict below.
- Source: https://code.claude.com/docs/en/costs

### Tier 1 — small setup cost, real productivity/observability gain

**6. Claude-Code-Usage-Monitor (real-time burn-rate + 5-hour-block forecasting)**
- What: Python terminal dashboard with ML (P90) burn-rate prediction against your 5-hour billing block, using Claude Code's own `rate_limits`/statusline data as the authoritative source (not just inferred token counts). Persistent history beyond Claude's 30-day retention window.
- Install (recommended): `uv tool install claude-monitor` then `claude-monitor`. pip/pipx/conda also documented.
- Auth/context cost: none — local Python tool, no MCP registration.
- Gain: complements ccusage's after-the-fact reporting with a forward-looking "will I blow through my block" view — useful given this repo's autonomous-loop cost telemetry already tracks ~$40/slice historically.
- Caveats (verified): actively maintained (v4.0.0, 2026-06-27, 8.5k★, 438 forks, 170 commits, 12 releases — all confirmed via GitHub API). **Do not** cite it as having a README line saying "Windows (PowerShell compatible)" — that exact phrase does not exist in the README on two independent checks; the tool nonetheless does install/run on Windows via the documented `uv`/pip/pipx steps (PowerShell is used only as the *installer invocation shell*, not a stated compatibility guarantee). Known open bug: Windows timezone detection (`tzutil`) returns non-IANA names and silently falls back to UTC (github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/issues/188).
- **ADOPT NOW**, with the timezone caveat noted if you rely on its time-windowed views.
- Source: https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor

**7. Auto-format PostToolUse hook (Biome / ruff / dotnet format)**
- What: official, documented pattern — `PostToolUse` hook matched on `Edit|Write`, piping `tool_input.file_path` through `jq` to a formatter CLI.
- Windows-specific correction (verified, high confidence): a **shell-form** command hook (no `args` field) runs via **Git Bash by default on Windows**, not native PowerShell or cmd.exe. If you want an explicit PowerShell invocation (e.g. to call a `.ps1` formatting wrapper), use the **object-form** hook (`"command": "powershell.exe", "args": [...]`) instead of relying on the default shell-form interpreter.
- Working pattern (adapt per language), `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "jq -r '.tool_input.file_path' | xargs -I{} sh -c 'case \"{}\" in *.ts|*.tsx|*.js) biome format --write \"{}\" ;; *.py) ruff format \"{}\" ;; esac'", "timeout": 15 }
        ]
      }
    ]
  }
}
```
- **.NET correction (this is a real gap, not a nitpick):** verification specifically flagged that `dotnet format` does not accept a bare single-file path the way Prettier/Biome/ruff do — it conventionally targets a project or solution. The correct single-file invocation is:
  `dotnet format <path-to.csproj> --include <file-path>`
  For a PostToolUse hook, resolve the nearest `.csproj` from the edited file's directory (e.g., via a small PowerShell/Node helper script) before calling `dotnet format --include`.
- Gain: instant format-on-edit for TS/Python; C# needs the project-scoped invocation above rather than a drop-in.
- Cost: milliseconds per formatter call; keep this in the fast/cheap tier of the hook-vs-CI split (see item 9 below).
- **ADOPT NOW** for TS/Python; **ADOPT with the csproj-resolution wrapper** for C#.
- Sources: https://code.claude.com/docs/en/hooks-guide (official pattern + Git Bash-on-Windows default, both directly verified)

**8. Secret-blocking PreToolUse hook**
- What: PreToolUse hook matching `Bash`/`Edit`/`Write`, scanning content for known secret patterns (AWS keys, GitHub tokens, Stripe keys, JWTs, Anthropic API keys), `exit 2` to block and feed the reason back to Claude as corrective context.
- Mechanism (verified, high confidence, official docs): exit code 2 on a blockable event (PreToolUse) cancels the tool call and routes stderr to Claude; any other nonzero code just logs a transcript notice and lets the action proceed. This is event-dependent — PostToolUse/Notification/SessionStart etc. cannot block via exit 2 since the action already happened.
- Recommended pattern-matching engine: Gitleaks (pattern-matches hundreds of known secret formats) invoked from the hook script rather than hand-rolled regex.
- Note a real (unconfirmed, low-severity) bug report: github.com/anthropics/claude-code/issues/13744 alleges PreToolUse exit-2 sometimes fails to block Write/Edit specifically (works reliably for Bash) — closed as a duplicate, not maintainer-confirmed. Don't treat exit-2 blocking on Edit/Write as bulletproof without your own smoke test.
- **ADOPT NOW** for the Bash/commit path; verify Edit/Write blocking behavior yourself given the open bug report before relying on it exclusively.
- Sources: https://code.claude.com/docs/en/hooks-guide ; https://dev.to/myougatheaxo/claude-code-hooks-auto-format-security-guards-and-test-triggers-on-every-tool-call-33c9 ; https://github.com/anthropics/claude-code/issues/13744

**9. Hook vs. pre-commit/CI split — explicit boundary**
- **Belongs in a PostToolUse/PreToolUse hook** (fires on every edit, must stay fast): single-file auto-format (Biome/ruff/dotnet format on the one changed file), fast secret-pattern grep on the diff being written, blocking an obviously dangerous Bash command (e.g. `DROP SCHEMA`, `rm -rf`).
- **Belongs in pre-commit or CI, not a per-edit hook:** full lint suite, full test suite (even "tests affected by changed files" scoping is safer run at commit time — computing the affected-test graph plus running it is 5-30s+ on C#/large solutions per this repo's own CLAUDE.md), full-repo secret scan, type-check (`tsc --noEmit`, `dotnet build`). This repo's own `dev.stable` carve-out already encodes exactly this split (slice-scoped tests + secret grep mandatory pre-commit; typecheck/lint/format deferred as advisory) — the research corroborates that division rather than contradicting it.
- Rationale (verified via official docs): hooks default to a **10-minute timeout**, and an infinite-looping or slow hook **freezes the whole Claude Code session** — there is no async escape hatch. A full C# solution build inside a PostToolUse hook on every single edit is a latency trap, not a safety net.
- **ADOPT NOW** — this is a policy decision, zero implementation cost, and matches what's already partially encoded in this repo's constitution.
- Source: https://code.claude.com/docs/en/hooks-guide ; https://thepromptshelf.dev/blog/claude-code-pre-commit-hooks-guide/ [blog, directional guidance not independently re-verified — medium confidence on the specific "which checks go where" framing, high confidence on the timeout/freeze mechanism]

**10. Kubernetes MCP server (`containers/kubernetes-mcp-server`) — for AKS work**
- What: Go-native, talks directly to the Kubernetes API server (no kubectl/helm/Node/Python dependency). Toolsets: `config`, `core` (default) plus optional `helm`, `kcp`, `kiali`, `kubevirt`, `netobserv`, `tekton` via `--toolsets`.
- **Corrected tool count:** commonly quoted as "60+ tools" — verified by two independent direct counts of the README's tool tables at **~49 tools**, not 60+. Use 49 as your context-budgeting number.
- Auth: kubeconfig, in-cluster config, or **OAuth/OIDC via Microsoft Entra ID** in HTTP mode — a direct match for your Azure/AKS environment. `--read-only` flag available for safety.
- Install JSON (Claude Code, Windows, npx path — no local kubectl/Node needed at runtime once installed):
```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "kubernetes-mcp-server@latest", "--toolsets", "config,core", "--read-only"]
    }
  }
}
```
- Context cost: ~49 tools × ~100-300 tokens/tool under Tool Search's deferred-listing model — names only enter context at session start; full schemas load on first use. Under the old (pre-deferred) full-upfront model this would have been a heavy server; under current default behavior it's cheap to keep connected.
- Maintenance: actively maintained — v0.0.65 (2026-07-14), 65 total releases at roughly 1-2 week cadence, 1.8k★/392 forks, repo pushed the same day as this research (2026-07-20).
- **Verdict — MCP vs kubectl CLI:** use this MCP server for exploratory/multi-step AKS investigation sessions where the Entra ID-scoped, `--read-only`-flagged, toolset-scoped access model earns its keep over a raw kubeconfig. For scripted one-shot checks (`kubectl get pods -n x`), keep using `kubectl` directly — zero context-listing cost per the CLI-preferred rule.
- **ADOPT NOW** for interactive AKS work.
- Sources: https://github.com/containers/kubernetes-mcp-server ; direct tool-count re-verification against the README's `### Tools` section (this research's own adversarial pass, medium-high confidence on the 49 figure)

### Tier 2 — conditional / adopt later

**11. Notion MCP server (official, `makenotion/notion-mcp-server`)**
- Only relevant **if you actually use Notion** — not named in your stated stack, so this is a "know it exists" entry, not an action item.
- Install: `npx -y @notionhq/notion-mcp-server`, auth via `NOTION_TOKEN` (internal integration secret, created at notion.so/profile/integrations), official Docker image `mcp/notion` also available. STDIO default, Streamable HTTP supported. 22 tools (v2.1.0, 2026-01-31).
- **Maintenance caveat (verified nuance, not full refutation):** Notion's own README states they are "prioritizing... active support for Notion MCP (remote)" and that issues/PRs on this local/open-source server "are not actively monitored" — i.e., it's real, official, and MIT-licensed, but in reduced-maintenance mode as Notion pushes users to a hosted remote MCP offering.
- **ADOPT LATER, conditional on actually using Notion** — and if you do adopt, prefer the newer remote/hosted Notion MCP over this local npx server given the deprioritization signal.
- Sources: https://github.com/makenotion/notion-mcp-server ; https://www.stackone.com/blog/notion-mcp-deep-dive/

**12. Linear MCP server (official, hosted)**
- Only relevant **if you track work in Linear** — not named in your stated stack.
- No local install: `claude mcp add --transport http linear-server https://mcp.linear.app/mcp`, then `/mcp` to authenticate. ~20-30 tools. Free on all plans, launched 2025-05-01.
- Auth: OAuth 2.1 with dynamic client registration is the **default/primary** flow (browser-based, no API key for that path) — **but the server also fully supports API-key/bearer-token auth as a documented alternative** (a claim in the raw research that flatly said "no API key management required" was corrected during verification; Linear's own docs confirm `Authorization: Bearer` with either an OAuth token or a Personal API Key is supported). This matters for your autonomous-loop use case: OAuth's interactive browser flow doesn't work headlessly, so **use the API-key path if you ever wire Linear into unattended dispatch**.
- Security note: the server returns everything the authenticated user can see (PII/source-code exposure risk) — use a read-only/restricted API key for any autonomous/headless usage rather than a full-scope OAuth session.
- **ADOPT LATER, conditional** — same posture as Notion.
- Source: https://www.gamut.so/blog/linear-mcp-server-guide ; https://linear.app/docs/mcp (primary, used to correct the auth overreach)

**13. Docker MCP — no vetted candidate found**
- This research pass surfaced no dedicated Docker MCP server source to evaluate (none of the six search angles returned one). Do not adopt anything sight-unseen here.
- **SKIP for now / needs a follow-up research pass.** In the meantime, keep using the `docker` CLI directly via Bash — zero context-listing cost, matches the CLI-preferred default posture anyway.

**14. GitHub MCP — redundant given your existing plugin**
- You already have a `github` plugin installed plus `gh` CLI access (in the excluded/already-installed list). Official guidance explicitly names `gh` as more context-efficient than an equivalent MCP server (zero per-tool listing cost).
- **SKIP** — adding a GitHub MCP server on top would only add tool-schema context cost for capability you already have covered.

**15. PostgreSQL MCP — active safety risk, skip**
- Landscape assessment (verified): Anthropic's own **reference Postgres MCP server was archived** after it executed `COMMIT; DROP SCHEMA public CASCADE;` despite being configured for read-only mode — a real, documented safety failure, not a hypothetical. **Postgres MCP Pro** (formerly Crystal DBA, acquired by Temporal) has stalled: last release v0.3.0 May 2025, final commits January 2026, despite a high star count. **pgconsole** is a promising newer entrant (default-deny IAM, per-connection rights, agent-identity/on-behalf-of delegation — exactly the safety model an agentic DB tool needs) but is young (~120★, early releases) — too immature to bet on. **Supabase MCP** only applies if you're on Supabase, not plain local Postgres.
- No source in this research names a single "best" option for plain local Postgres 18; the sources explicitly decline to (bytebase.com: "No single 'best' option").
- **Verdict — MCP vs psql:** use `psql` directly via Bash for your local Postgres 18 work. Zero context-listing cost, and you avoid the archived-reference-server class of failure entirely. Revisit pgconsole once it has a longer maintenance track record, and if you ever do connect an MCP server to Postgres, restrict its credentials to `SELECT`-only regardless of which server you pick.
- **SKIP for now.**
- Sources: https://www.bytebase.com/blog/top-open-source-postgres-mcp-servers/ ; https://datamcp.app/blog/best-postgres-mcp-2026

**16. Secondary observability tools — lighter adopt-later options**
- `token-dashboard` (nateherkai): zero-dependency (Python stdlib + vanilla JS/SQLite), `git clone` + `python3 cli.py dashboard`, local-only (self-reported no telemetry — not independently audited, medium confidence), 7-tab web UI (127.0.0.1:8080) with per-prompt cost ranking and tool/file heatmaps that `ccusage`'s CLI reports don't visually surface. 639★/174 forks, single maintainer — smaller and less battle-tested than ccusage. **ADOPT LATER** as a complement, not a replacement, if you want a visual hotspot view.
- `phuryn/claude-usage`: similar zero-dep stdlib tool, localhost:8080 dashboard, actively maintained (v1.5.5, 2026-07-10, 2000+★, 16 releases). Chart-rendering UI loads Chart.js from a CDN (needs internet for chart display only, not for the core JSONL parsing/cost computation, which is fully local). Install on Windows: **`uv tool install git+https://github.com/phuryn/claude-usage` or `pipx install ...`** — the tool's own README labels these "Any OS," so despite one raw-research claim asserting "Windows-practical paths are only clone/Docker," that's not accurate; `uv`/`pipx` install is the more practical single-command Windows path. Excludes Cowork/server-side sessions (local-only). **ADOPT LATER**, pick one of token-dashboard/claude-usage, not both.
- `ccflare`: browser dashboard (`npm install -g ccflare` + `ccflare serve`), interactive charts, multi-project comparison, proxy-based multi-account usage routing. **[unverified — lower confidence, single roundup-blog source, not adversarially re-checked]**.
- `claude-doctor` (millionco): diagnostic CLI (`npx claude-doctor check`, 541★) — catches context/hook/MCP config issues before they inflate token bills. **[unverified — lower confidence]**.
- `ccstatusline` (sirmalloc): terminal statusline formatter via Claude Code's native `statusLine` setting — model, git branch, token metrics, session timer, cost, all inline. **[unverified — lower confidence]** but if accurate, zero-cost since it uses a setting you already have.
- Sources: https://github.com/nateherkai/token-dashboard ; https://github.com/phuryn/claude-usage ; https://claudefa.st/blog/tools/monitors/claude-code-usage-monitor [roundup, lower confidence for ccflare/claude-doctor/ccstatusline specifically]

**17. OpenTelemetry export for team-wide cost observability**
- Relevant if you ever need fleet-wide (not just personal) cost/token/tool-activity visibility, especially on non-first-party-API routing (Bedrock/GCP/Azure Foundry) — exports per-user metrics to your own observability stack.
- Given you're solo-driving this repo today with `/usage` + ccusage already covering personal visibility, this is **ADOPT LATER**, scoped to when you actually stand up team-wide dashboards.
- Source: https://code.claude.com/docs/en/costs

### Tier 3 — reject

**18. `ryanlewis/claude-format-hook`**
- 100% shell script, no C#/`dotnet format` support at all, no Windows/PowerShell notes, 4★, 3 total commits, no releases, fully manual install (download script, chmod, hand-merge JSON).
- **SKIP.** Use the official documented PostToolUse pattern (item 7 above) instead — it's better-supported and you'll need to hand-write the `.csproj`-resolution wrapper regardless.
- Source: https://github.com/ryanlewis/claude-format-hook [flagged unreliable source quality in the original research pass]

---

## Q1 — MCP server per tool: install/auth/verdict summary table

| Tool | Best server | Install | Auth | Tools (verified) | Context cost | Verdict |
|---|---|---|---|---|---|---|
| PostgreSQL | *(none recommended)* | `psql` CLI | n/a | n/a | zero | **SKIP MCP** — reference server archived after DROP SCHEMA incident; Pro server stalled; pgconsole too young |
| Docker | *(not researched)* | `docker` CLI | n/a | n/a | zero | **SKIP / needs follow-up research** |
| Kubernetes | `containers/kubernetes-mcp-server` | `npx -y kubernetes-mcp-server@latest` | kubeconfig / in-cluster / Entra ID OAuth (HTTP mode) | ~49 (corrected from claimed "60+") | deferred by default; cheap under Tool Search | **ADOPT for interactive AKS work; CLI for scripted checks** |
| GitHub | *(already covered)* | existing `github` plugin + `gh` CLI | n/a | n/a | zero (CLI) | **SKIP — redundant** |
| Notion | `makenotion/notion-mcp-server` (official) | `npx -y @notionhq/notion-mcp-server` | `NOTION_TOKEN` (integration secret) | 22 | deferred by default | **ADOPT LATER, conditional on Notion usage; local server in reduced-maintenance mode, prefer remote if adopting** |
| Linear | official hosted `mcp.linear.app` | `claude mcp add --transport http linear-server https://mcp.linear.app/mcp` | OAuth 2.1 (default) **or** API-key Bearer token (for headless/CI) | ~20-30 | deferred by default | **ADOPT LATER, conditional on Linear usage; use API-key auth for autonomous-loop use** |

---

## Q2 — Context budget

**Verified baseline:** MCP tool schema deferral (Tool Search) is **default** in current Claude Code — only tool names enter context at session start; full schemas load on first use. Confirmed directly against official docs (`code.claude.com/docs/en/costs`, `/en/mcp#scale-with-mcp-tool-search`), high confidence, multiple independent verification passes agreed. Exceptions to the default: Google Cloud Agent Platform, non-first-party `ANTHROPIC_BASE_URL` proxies, `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` set, pre-Sonnet-4.5-class models, and — a real, currently-open exception — **`mcp-remote`-proxied MCP transports are not deferred** (github.com/anthropics/claude-code/issues/25894). None of the blanket exceptions apply to a standard Windows Claude Code CLI session on Opus 4.8; check whether any of your MCP servers go through `mcp-remote` specifically.

**Historical/illustrative numbers (pre-Tool-Search or single-source, not independently re-verified — treat as directional, not measured-for-your-setup):**
- One case study: 4 connected MCP servers ≈ 67,000 tokens overhead; another with 7 servers ≈ 67,300 tokens (33.7% of a 200k window) before Tool Search-style mitigation. **[unverified — lower confidence, forum/blog source, GitHub issue #11364 filed 2025-11-10, closed as duplicate without a direct engineering confirmation]**.
- Individual tool definitions: ~100-500 tokens typically, 550-850 tokens for complex schemas (MindStudio blog, 2026-04-02) — **[unverified — lower confidence]**.
- Rough sizing formula from the same source: `tokens ≈ (number_of_tools × 200) + (total_description_chars ÷ 4)`.
- One blog reported Tool Search cutting a specific session from 51K→8.5K tokens (46.9% reduction) — **[unverified — lower confidence, single example]**, but directionally consistent with the (verified) fact that deferral is now default behavior.
- If you ever author your own MCP server (relevant given this repo ships its own plugin marketplace): consolidating many single-purpose tool definitions into fewer parameterized tools cut one server's footprint 60% (20 tools/14,214 tokens → 8 tools/5,663 tokens) while average tokens-per-tool stayed flat — the saving came from fewer tool *definitions*, not leaner descriptions. **[unverified — lower confidence, single blog, dated 2025-09-30, pre-dates default Tool Search]**, but the underlying mechanical point (fewer, parameterized tools > many narrow tools) is a reasonable MCP-authoring principle independent of the specific numbers.

**Mitigation techniques, ranked by effort:**
1. Do nothing extra — Tool Search already handles the common case (verified, default-on).
2. `/context` to see what's actually consuming space; `/mcp` to audit and disable unused servers per-repo.
3. Per-project `.mcp.json` scoping — connect servers only in repos that need them (scottspence.com, practical mitigation guidance, not independently re-verified this pass — medium confidence but consistent with official `/mcp`-disable guidance).
4. Prefer CLI tools (`gh`/`kubectl`/`docker`/`psql`) over MCP equivalents wherever a one-shot/scripted interaction is all you need — zero per-tool-listing cost, verified official guidance.
5. `disableBundledSkills` setting / `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` env var (shipped v2.1.181, 2026-06-17) to hide bundled skills/workflows/built-in slash commands you don't use — directly relevant to a 35-plugin setup, primary changelog source, not adversarially re-verified but Anthropic's own changelog is authoritative for its own product.
6. Avoid `mcp-remote`-proxied MCP transports if avoidable — they bypass the deferred-loading default (verified exception, see above).

Sources: https://code.claude.com/docs/en/costs ; https://code.claude.com/docs/en/mcp ; https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code ; https://ai.gopubby.com/mcp-tools-are-eating-82-of-your-context-window-the-10-minute-fix-for-claude-code-1619733d00dc [82% extreme case study, lower confidence] ; https://github.com/anthropics/claude-code/issues/11364 ; https://www.mindstudio.ai/blog/claude-code-mcp-server-token-overhead ; https://paddo.dev/blog/claude-code-hidden-mcp-flag/ [describes now largely-obsolete `ENABLE_EXPERIMENTAL_MCP_CLI` flag]

---

## Q3 — Hooks

See Tier 1 items 7-9 above for the concrete working patterns. Summary of the load-bearing verified facts:

- Exit code semantics (verified, official docs, high confidence): **exit 2** on a blockable event (PreToolUse) cancels the action and feeds stderr to Claude as corrective feedback. **Any other nonzero exit code** lets the action proceed, with only a transcript notice. PostToolUse cannot block at all (the edit already happened) — it's for post-hoc actions like formatting.
- **Windows-specific mechanic (verified, high confidence):** a shell-form hook command (no `args` key) runs via **Git Bash by default on Windows**, not cmd.exe or PowerShell. To invoke PowerShell explicitly (e.g., the official `.NET MessageBox` notification example), use object-form with `"command": "powershell.exe"` and an `args` array.
- Default timeouts: `command`/`http`/`mcp_tool` hooks = 10 minutes; `UserPromptSubmit` = 30 seconds; `MessageDisplay` = 10 seconds. An infinite-looping hook freezes the session — always set an explicit `timeout`.
- **What belongs where (hook vs. pre-commit/CI):** fast, single-file, deterministic checks (format-on-save, obvious-danger command blocking, fast pattern-match secret grep on the one file/diff being written) → hooks. Anything that scales with repo size or needs a full build/typecheck/test-affected-graph computation (full lint, full test suite, full-repo secret scan, `tsc --noEmit`, `dotnet build`) → pre-commit or CI. This matches — and is corroborated by — this repo's own existing `dev.stable` gate design (slice-scoped tests + secret grep mandatory at commit time; typecheck/lint/format deferred as advisory to the review cycle).
- Ruff correction: one raw claim asserted "Ruff covers all three tools [lint/format/type-check] in a single binary" — **that overstates Ruff's actual scope**. Ruff does linting and formatting; it does not type-check. Continue pairing it with your already-installed pyright LSP / mypy for type-checking.

Sources: https://code.claude.com/docs/en/hooks-guide (primary, most claims directly verified) ; https://dev.to/myougatheaxo/claude-code-hooks-auto-format-security-guards-and-test-triggers-on-every-tool-call-33c9 ; https://thepromptshelf.dev/blog/claude-code-pre-commit-hooks-guide/ [hook-vs-pre-commit framing, medium confidence — Unix/bash-oriented, no Windows-specific instructions] ; https://pydevtools.com/handbook/how-to/how-to-configure-ruff-with-claude-code/

---

## Q4 — Observability

Ranked list is in Tier 0/1/2 above (`ccusage`, `/usage`+`/context`, Claude-Code-Usage-Monitor, token-dashboard, claude-usage, OpenTelemetry). No further detail beyond what's captured there — this question's findings are fully represented in the ranked adoption list.

---

## Q5 — Knowledge retrieval over in-repo Markdown (ADRs/specs/handoffs)

**Converging recommendation across four independent sources: use a ripgrep-based Skill, not a vector-index MCP server.**

- An Anthropic team member (Boris) is quoted describing internal testing where agentic tool-calling search "outperformed everything, by a lot" versus RAG — **[medium confidence: single-source attribution via a third-party blog, not independently corroborated by a second primary source, though internally consistent with Anthropic's own public design choices]**.
- Mechanism-level reasoning (corroborated across sources, not contradicted anywhere in verification): agentic search avoids the "Indexing Tax" — no embedding service, no vector DB, no staleness/drift to maintain — and keeps everything local (no external vector store = smaller compliance/security surface for your ADRs/specs). Every search step is visible/auditable. The tradeoff is higher token cost per query than a single RAG retrieval call, offset by the ability to iteratively course-correct, which single-shot RAG can't do.
- Decision heuristic (two independent sources converge on this framing): reach for an MCP server specifically when the use case involves "query," "fetch," or "current state" of something *external* and *live* (a database, a ticket tracker, a real API). Use a **Skill** — deterministic, curated, markdown-native, no embeddings — for static, versioned, human-curated knowledge, which is exactly what your `.claude/artifacts/crew/` handoffs, `docs/backlog/`, and ADRs are.
- Practical ripgrep guidance (single blog, 2026-04-19, not independently re-verified — medium confidence but internally plausible): the bundled ripgrep is fine for small-to-medium repos (this repo qualifies); an MCP-server-wrapped ripgrep is *slower* than calling ripgrep directly due to the extra communication-layer hop, so if you build a custom retrieval skill, shell out to ripgrep/Grep directly rather than wrapping it in an MCP server; only consider installing/preferring a system ripgrep binary over the bundled one at very large scale (100k+ files) — well beyond this repo's size.
- There's prior art for exactly this shape: a packaged "ripgrep search" Skill exists as a template (mcpmarket.com listing).

**Bottom line for this repo:** your `crew:investigator`/`crew:researcher` agents already do the right thing architecturally (Grep/Glob/Read over the repo). The actionable gap, if any, is a small packaged Skill that pre-seeds good ripgrep incantations scoped to `.claude/artifacts/crew/**`, `docs/backlog/**`, and `docs/specs/**` for fast ADR/handoff lookup — not new retrieval infrastructure, and definitely not a vector-index MCP server.

Sources: https://zerofilter.medium.com/why-claude-code-is-special-for-not-doing-rag-vector-search-agent-search-tool-calling-versus-41b9a6c0f4d9 [Boris quote, medium confidence] ; https://systemprompt.io/guides/claude-skills-vs-agents-vs-mcp ; https://www.verdent.ai/guides/claude-skills-vs-mcp-agents-comparison ; https://blog.codonomics.com/2026/04/beyond-grep-master-ripgrep-performance.html [medium confidence] ; https://mcpmarket.com/tools/skills/ripgrep-search

---

## Q6 — Genuinely new in the last ~3 months (corrected version timeline)

Several version/date attributions in the raw research were wrong and are corrected here based on adversarial re-verification against the primary changelog (`code.claude.com/docs/en/changelog` and `github.com/anthropics/claude-code/blob/main/CHANGELOG.md`):

| Version | Date | What actually shipped (verified) |
|---|---|---|
| v2.1.154 | — | MCP trust/approval gate **first introduced**: `claude mcp list/get` shows unapproved `.mcp.json` servers as "⏸ Pending approval" instead of auto-approving. *(Corrects a raw claim that attributed this to v2.1.196.)* |
| v2.1.181 | 2026-06-17 | `disableBundledSkills` setting + `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` env var — hides bundled skills/workflows/built-in commands. Relevant context-budget lever for your 35-plugin setup. |
| v2.1.196 | — | Narrower security fix: `claude mcp list/get` no longer auto-spawn `.mcp.json` servers self-approved via a committed `.claude/settings.json` in untrusted workspaces (closes a bypass of the v2.1.154 gate — does **not** introduce the gate itself). |
| v2.1.197 | — | Claude Sonnet 5 introduced as default model, 1M-token context (matches this session's model). |
| v2.1.198 | 2026-07-01 | **Subagents run in the background by default**; background agent notifications (`agent_needs_input`/`agent_completed`) fire via `claude agents`. *(Corrects a raw claim that attributed this to v2.1.212 — v2.1.212 is a different, later change; see below.)* |
| v2.1.205 | — | Fixed a Windows-specific bug where worktree removal deleted files **outside** the worktree — relevant given your parallel-worktree workflow. |
| v2.1.208 | 2026-07-14 | **Caches tool-pool assembly** — up to 7x faster tool rounds at high tool counts in print/SDK sessions with many MCP tools; also reduced session-transcript size up to 79x in edit-heavy sessions by pruning superseded file-history backups. *(Corrects a raw claim that attributed the tool-pool-caching change to v2.1.214 — that version's actual content is listed next.)* |
| v2.1.212 | 2026-07-17 | Per-session cap of 200 subagent spawns (`CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION`, resets on `/clear`), 200-call default WebSearch cap, and `/fork` changed to spawn a background session in `claude agents` (old in-session subagent launch renamed `/subtask`). Worth knowing given your peer-dispatch/swarm/wave subagent-heavy usage — 200 is a real ceiling on large autonomous runs. |
| v2.1.214 | 2026-07-18 | Permission-check tightening, safer Bash/**PowerShell** command validation, new `EndConversation` tool, background-session cleanup fixes, OTel attribute additions. |

**Other genuinely new items worth your attention (primary changelog source, not individually adversarially re-verified beyond the version-number cross-checks above — treat as reasonably confident since it's Anthropic's own changelog):**
- **Skills-stacking fix** (~2026-07-02): multiple stacked skills invoked at once now all fire correctly (previously only the first would); re-invoking an already-loaded skill no longer duplicates its instructions in context. Directly relevant to a 35-plugin, skill-heavy setup — less redundant context bloat from re-triggered skills.
- Chrome/browser integration taken out of beta (~2026-07-01) — low relevance given Playwright MCP is already your installed browser-automation path.
- Live counter/heartbeat for long-running tool calls (~2026-07-14) — improves visibility during long autonomous-loop dispatches.
- Subagent-insight forwarding into "workflows" (~2026-07-15) — potentially useful for tightening crew's peer-dispatch/handoff artifacts; worth a look.
- Screen-reader support + vim insert-mode remapping (~2026-07-13) — accessibility/editing UX, apply only if relevant to your workflow.

Sources: https://code.claude.com/docs/en/changelog ; https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md (primary sources for the corrected table above) ; https://releasebot.io/updates/anthropic/claude-code and https://www.gradually.ai/en/changelogs/claude-code/ [third-party aggregators, used only as corroboration, not as the basis for any correction]

---

## Verification notes / methodology transparency

- 117 individual claims were extracted from 26 source batches; 75 adversarial verification passes were completed before the run was killed. Claims with 3 verdicts were resolved by 2-of-3 refute. Claims with 1-2 verdicts were resolved by majority-of-available (noted inline). Claims with 0 verdicts are marked **[unverified — lower confidence]** throughout this report rather than presented as fact.
- Claims **killed** (≥2 refuting verdicts) and corrected in this report: kubernetes-mcp-server "60+ tools" (→ ~49); Claude-Code-Usage-Monitor's README containing a "(PowerShell compatible)" line (→ no such line exists, though Windows install steps are documented); `phuryn/claude-usage` "Windows-practical paths are clone/Docker only" (→ `uv tool install`/`pipx` are the practical Windows paths per the README's own "Any OS" labeling); three changelog version misattributions (background-subagents-default, tool-pool-caching, MCP-approval-gate — corrected in the Q6 table above); Linear MCP "no API key management required" stated without qualification (→ API-key auth is a fully supported alternative to the OAuth default).
- Claims that survived verification at 1-of-3 refute (kept, with the dissenting view noted as a caveat): Notion server "maintained by Notion" (kept — official/MIT/makenotion-org confirmed; caveat: local repo is in reduced-maintenance mode); the official hooks-guide auto-format pattern "generalizing to Biome/dotnet format/ruff" (kept — mechanically valid; caveat: `dotnet format` needs a project-scoped invocation, not a bare file path, so the "just swap the command" framing needed the explicit fix given in this report).
