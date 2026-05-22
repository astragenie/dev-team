# Grep vs LSP — when to use which

Crew workflow runs exploration-heavy by default ("identify the affected area, read relevant docs first"). That style is correct for intent but expensive when reflexively translated to `Grep` calls. This doc is the disambiguator.

## Tool selection by intent

| You want to… | Use | Why |
|---|---|---|
| Find a function/class/type definition by name | **LSP** `definition` | One semantic call, exact match, no false hits in comments/strings |
| Find every caller of a function | **LSP** `references` | Semantic, cross-file, no `grep` regex assembly |
| Hover for type info | **LSP** `hover` | Free; impossible with grep |
| Rename / impact analysis | **LSP** `references` then plan | Catches all uses, not just textual matches |
| Find files by name pattern | **Glob** | Built for this; no shell needed |
| Search prose / comments / strings / markdown | **Grep** | LSP doesn't index those |
| Search configs (yaml/json/toml) | **Grep** | LSP not language-aware for config files |
| Find a regex pattern (literal/multiline) | **Grep** (`multiline: true`) | LSP can't do this |
| Inspect file contents you've never read | **Read** with `offset`/`limit` | Direct; no search needed |
| Re-check something you just verified | **Don't** | Trust prior result; that's the whole point |

## Hard rules

1. **No `Grep` for symbol lookup when LSP is available.** OmniSharp (.NET), tsserver (TypeScript), Python language server, Rust analyzer all index symbols. Use them.

2. **One Grep call instead of N.** Use alternation (`foo\|bar\|baz`), use `-A`/`-B` context, use `head_limit`, use `output_mode: content`. Bundle. The cost-advisor `bash-bloat` rule fires when result bytes drift above 8KB — same logic applies to Grep when you call it 5× for related patterns.

3. **No redundant Reads.** If you Read `Foo.cs` in turn N, do not Read `Foo.cs` in turn N+3 unless you edited it. The cost-report `redundant_read_count` field exposes this; the advisor flags it at >5.

4. **Stop at the second exploration pass.** First pass: map the area. Second pass: confirm the change point. Beyond that: write the plan and start editing. The advisor's `exploration-heavy` rule fires at 4× and is now MEDIUM by default.

## Specific replacements

### Finding a function definition

```text
# Old
Grep("function foo")             # text-only, may miss class methods, miss .ts arrow funcs

# New
LSP("definition", "foo")         # semantic, language-aware
```

### Finding callers

```text
# Old
Grep("\\bfoo\\(")                # regex; misses spread/destructure usage; false-matches `foo` in strings

# New
LSP("references", "foo")         # exact use sites across files
```

### Cross-cutting refactor scan

```text
# Old — 3 separate greps that each bust cache
Grep("MemoryService\\.Api")
Grep("MemoryService\\.Infrastructure")
Grep("MemoryService\\.Mcp")

# New — one alternation grep
Grep("MemoryService\\.(Api|Infrastructure|Mcp)", { output_mode: "files_with_matches", head_limit: 50 })
```

### Same-file iteration

```text
# Old — Read the file every time
Read("MemoryWriteService.cs")    # turn 5
# (edit)
Read("MemoryWriteService.cs")    # turn 8 — TRUST your turn-5 read
# (edit)

# New
Read once at slice start. Trust the result. If you need a specific section after editing, Read with offset+limit to that section only.
```

## Why this matters

Each Grep result + Read body becomes a tool_result block that the next assistant turn ingests as cache_create input. On Opus that's ~$0.019 per 1K tokens of fresh cache. A redundant 5KB Read costs about ~$0.10 in cache_create alone, before any output tokens. Multiply across a 100-turn slice and the wasted greps add up to single digits of real dollars.

The advisor rules that track this:
- `exploration-heavy` — MEDIUM at 4×, HIGH at 8×
- `bash-bloat` — MEDIUM when Bash avg result > 8KB
- `file-rereads` — MEDIUM at 5+, HIGH at 15+
- `large-tool-output` — MEDIUM at p90 > 8KB, HIGH at > 30KB

When one of these fires, this doc is the playbook.

## Edge cases — when grep is right

- LSP server not running or slow to start (cold OmniSharp on big sln)
- Cross-language search (looking for a string that appears in .cs + .ts + .yml + .md simultaneously)
- The thing you're looking for isn't a symbol (a constant string, log message, error code)
- The codebase doesn't have a language server (Bash scripts, prose, ad-hoc DSLs)

In those cases Grep is correct. Just bundle the calls.

## Tool selection cheatsheet

| Tool | Cheap | Expensive | Avoid when |
|---|---|---|---|
| `LSP` | ✓ for symbol queries | First call (server warmup) | No LSP for the file type |
| `Grep` | Single-term, scoped, `head_limit` | Repeated calls for related patterns | LSP available for symbol query |
| `Glob` | Almost always | Walking a huge tree without filter | Looking for content, not paths |
| `Read` | Bounded by offset+limit | Full file >2K lines | Already read this file recently |
| `Bash` | One-shot commands | Broad output, repeated git status | Output >8KB; use `\| head -N` |
| `Edit` | Trust prior Read | None inherent | Without matching old_string verification |
