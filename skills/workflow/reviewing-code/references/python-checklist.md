# Python code-review checklist

Extracted from `agents/3rdparty/code-reviewer.md`.

## Mutable default arguments

Flag `def fn(items=[])` — mutable default arguments are evaluated once at function definition and cause shared-state bugs across calls.

**Fix:** Use `None` as the default and initialise inside the function body:

```python
def fn(items=None):
    if items is None:
        items = []
```

## Exception handling

Flag bare `except:` clauses — they swallow `KeyboardInterrupt`, `SystemExit`, and other non-error exceptions.
Require at least `except Exception:` and ideally a specific exception type.

## Type hints

Require type hints on all public function signatures. Private/internal helpers can be unannotated but should be annotated when they participate in complex logic.

## Dangerous builtins

Flag `eval()` and `exec()` on any user-supplied input — these allow arbitrary code execution. Require a documented justification and input sanitisation review when present.

## Checklist summary

| Check | Severity if violated |
|---|---|
| Mutable default argument | MEDIUM |
| Bare `except:` clause | HIGH |
| Missing type hints on public function | LOW |
| `eval()` / `exec()` on user input | CRITICAL |
