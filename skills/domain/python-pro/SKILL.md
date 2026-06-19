---
name: python-pro
prompt_id: python-pro
version: 1.0.0
tier: domain
description: Production-ready Python 3.12+ guidance — type safety, async patterns, testing, performance, and web frameworks. Consult when writing or reviewing Python code.
source: aitmpl/programming-languages/python-pro
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: ["*.py", "pyproject.toml", "requirements.txt", "setup.py", "uv.lock"]
---

# Python Pro

Specialist guidance for modern, type-safe, production-ready Python development.

## When to use

Consult this skill when:
- Writing or reviewing Python code in any tier (API, data, CLI, library)
- Modernizing a Python codebase to 3.12+ idioms
- Adding async I/O, type coverage, or test infrastructure
- Selecting frameworks (FastAPI vs Django vs Flask, uv vs Poetry)
- Optimizing a data processing or I/O pipeline

## Development Checklist

- Type hints on all function signatures and class attributes
- PEP 8 compliance via `ruff format` + `ruff check`
- Google-style docstrings on public APIs
- Test coverage >90% with pytest
- Custom exception hierarchy for domain errors
- `async`/`await` for all I/O-bound operations
- `bandit` security scan passing

## Pythonic Patterns

- List/dict/set comprehensions over imperative loops
- Generator expressions for memory-efficient iteration
- Context managers (`with`) for all resource lifecycles
- Decorators for cross-cutting concerns (retry, logging, auth)
- Properties for computed attributes (avoid bare getters)
- Dataclasses or Pydantic models for data structures
- Protocols for structural (duck) typing
- `match` / `case` for complex branching (3.10+)

## Type System

- PEP 695 syntax: `def fn[T](...)`, `type Alias = ...` (3.12+)
- `TypeVar` + `ParamSpec` for generic decorators
- `Protocol` definitions for duck typing
- `TypedDict` for typed dict shapes
- `Literal` for constant-valued parameters
- `Union` / `Optional` handling — prefer `X | None` syntax
- Run `mypy --strict` or `pyright` on CI

## Async and Concurrency

- `asyncio` for I/O-bound concurrency; `concurrent.futures` for CPU-bound
- `asynccontextmanager` for async resource management
- Task groups (`asyncio.TaskGroup`, 3.11+) with structured error handling
- `asyncio.Queue` / `asyncio.Lock` for thread-safe async coordination
- `multiprocessing` for CPU parallelism; avoid threads for GIL-bound work
- Free-threaded mode (PEP 703, Python 3.13+) for CPU-bound async workloads

## Framework Guidance

| Need | Recommended |
|---|---|
| Async REST API | FastAPI + Pydantic v2 + SQLAlchemy async |
| Full-stack / admin | Django |
| Lightweight service | Flask |
| ORM (FastAPI-native) | SQLModel (Pydantic v2 + SQLAlchemy) |
| Task queue | Celery + Redis |
| Data validation | Pydantic v2 (`model_config`, `TypeAdapter`) |

## Testing

- Fixtures for test data; `pytest.mark.parametrize` for edge cases
- `unittest.mock` / `pytest-mock` for dependency isolation
- `pytest-cov` for coverage; target >90%
- `hypothesis` for property-based testing of invariants
- Async tests via `pytest-asyncio`

## Package Management

- Prefer `uv` for new projects: `uv init`, `uv add`, `uv lock`
- Single `pyproject.toml` as project config (no `setup.py`)
- `uv.lock` for cross-platform reproducible installs
- Docker images: base on `python:3.12-slim`, install deps via `uv sync --frozen`

## Performance

- Profile with `cProfile` + `line_profiler` before optimizing
- Memory: `memory_profiler`, generators for large datasets, `weakref` caches
- Vectorize with NumPy; heavy DataFrames → Polars (lazy evaluation + streaming)
- Numba JIT for numerical hot paths; Cython for C-extension critical paths
- Cache pure functions with `functools.lru_cache` / `functools.cache`

## Security

- Validate and sanitize all external input
- Parameterized queries only — never f-string SQL
- Secrets via env vars or vault; never in source
- `bandit` scan on CI; target zero high-severity findings
- OWASP Top 10 compliance for web services

## Database Patterns

- Async SQLAlchemy: `async_session`, connection pooling configured
- Migrations via Alembic; never hand-edit schema in prod
- Transaction management: explicit `async with session.begin()`
- NoSQL: Motor (async MongoDB), redis-py async for cache

## CLI Patterns

- `click` for command structure + `rich` for terminal output
- `tqdm` progress bars for long-running operations
- Configuration via Pydantic `BaseSettings` (env + `.env` file)
- Distribute as binary via `pyinstaller` or `shiv`

## Done / Acceptance

Change is production-ready when:
- `ruff format .` produces no diff
- `ruff check .` passes with zero errors
- `mypy --strict` (or `pyright`) exits 0
- `pytest --cov` reports >90% coverage
- `bandit -r .` reports no high-severity findings
- All public APIs have type annotations and docstrings
