---
name: webapp-testing
tier: workflow
description: Interact with and test local web applications using Python Playwright — use when verifying frontend functionality, debugging UI behavior, capturing screenshots, or observing browser console logs during development.
source: davila7/claude-code-templates/cli-tool/components/skills/development/webapp-testing
source_version: 2026-06-08
last_reviewed: 2026-06-08
owner: hero-crew
triggers: ["playwright", "webapp testing", "browser test", "UI test", "screenshot", "browser logs", "frontend verification", "e2e", "local web app", "test web application", "browser automation", "with_server.py"]
---

# Web Application Testing

Toolkit for interacting with and testing local web applications using Playwright.
Supports verifying frontend functionality, debugging UI behavior, capturing browser
screenshots, and viewing browser logs.

Write native Python Playwright scripts for all web application testing.

## When to use

Consult this skill when:
- Verifying frontend functionality in a locally running web app
- Debugging UI behavior or confirming a fix works in the real app
- Capturing screenshots of pages or components
- Observing browser console logs during a test run
- Automating form fills, navigation, or click flows in a local app
- Running e2e smoke checks against a dev server

## Helper Scripts

**`scripts/with_server.py`** — Manages server lifecycle (supports multiple servers).

Always run scripts with `--help` first to see usage. Do NOT read the source — these scripts
exist as black-box utilities. Use `--help`, then invoke directly.

## Decision Tree: Choosing Your Approach

```
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         ├─ Success → Write Playwright script using selectors
    │         └─ Fails/Incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No → Run: python scripts/with_server.py --help
        │        Then use the helper + write simplified Playwright script
        │
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and wait for networkidle
            2. Take screenshot or inspect DOM
            3. Identify selectors from rendered state
            4. Execute actions with discovered selectors
```

## Server Management

**Single server:**
```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py
```

**Multiple servers (e.g., backend + frontend):**
```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_automation.py
```

## Playwright Script Template

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)  # Always headless
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')  # CRITICAL: wait for JS
    # ... automation logic
    browser.close()
```

## Reconnaissance-Then-Action Pattern

1. **Inspect rendered DOM**:
   ```python
   page.screenshot(path='/tmp/inspect.png', full_page=True)
   content = page.content()
   page.locator('button').all()
   ```
2. **Identify selectors** from inspection results
3. **Execute actions** using discovered selectors

## Best Practices

- Always `wait_for_load_state('networkidle')` before inspecting dynamic apps
- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs
- Add appropriate waits: `page.wait_for_selector()` or `page.wait_for_timeout()`
- Use `sync_playwright()` for synchronous scripts
- Always close the browser when done

## Common Pitfall

Do NOT inspect the DOM before waiting for `networkidle` on dynamic apps — you will
see stale or incomplete DOM state.

## Done / Acceptance

A webapp-testing task is complete when:
- Target URL is reached and `networkidle` is confirmed
- All assertions or observations are captured (screenshots, console logs, DOM state)
- Script exits cleanly with the browser closed
- Results match expected behavior or discrepancies are clearly reported
