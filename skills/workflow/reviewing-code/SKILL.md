---
name: reviewing-code
tier: workflow
description: Comprehensive code review skill for TypeScript, JavaScript, Python, Swift, Kotlin, Go. Includes automated code analysis, best practice checking, security scanning, and review checklist generation. Use when reviewing pull requests, providing code feedback, identifying issues, or ensuring code quality standards.
source: aitmpl/development/code-reviewer
source_version: 2026-06-04
last_reviewed: 2026-06-04
triggers: [code-review, pull-request, PR, security-review, typescript, python, rust, go, sql]
owner: hero-crew
---

# Reviewing Code

Complete toolkit for code review with modern tools and best practices.

## When to use

- Reviewing a pull request or diff before merge
- Providing structured feedback on changed files
- Enforcing security, correctness, performance, or style standards
- Pre-deployment quality gate for any language in the supported stack

## Quick Start

```bash
# PR analysis
python scripts/pr_analyzer.py <project-path> [options]

# Code quality check
python scripts/code_quality_checker.py <target-path> [--verbose]

# Review report generation
python scripts/review_report_generator.py [arguments] [options]
```

## Core Capabilities

### 1. PR Analyzer

Automated analysis of pull request changes.

**Features:** Automated scaffolding, best practices validation, configurable templates, quality checks.

### 2. Code Quality Checker

Comprehensive analysis and optimization tool.

**Features:** Deep analysis, performance metrics, recommendations, automated fixes.

### 3. Review Report Generator

Advanced tooling for review reporting.

**Features:** Expert-level automation, custom configurations, integration ready, production-grade output.

## Reference Documentation

- **Code Review Checklist** — `references/code_review_checklist.md`: patterns, code examples, best practices, anti-patterns, real-world scenarios.
- **Coding Standards** — `references/coding_standards.md`: step-by-step processes, optimization strategies, tool integrations, performance tuning.
- **Common Antipatterns** — `references/common_antipatterns.md`: technology details, integration patterns, security considerations, scalability guidelines.

## Tech Stack

**Languages:** TypeScript, JavaScript, Python, Go, Swift, Kotlin
**Frontend:** React, Next.js, React Native, Flutter
**Backend:** Node.js, Express, GraphQL, REST APIs
**Database:** PostgreSQL, Prisma, NeonDB, Supabase
**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, CircleCI
**Cloud:** AWS, GCP, Azure

## Development Workflow

1. **Setup:** `npm install` or `pip install -r requirements.txt`; copy `.env.example .env`
2. **Run checks:** `python scripts/code_quality_checker.py .`
3. **Apply practices** from `references/code_review_checklist.md`, `references/coding_standards.md`, `references/common_antipatterns.md`

## Common Commands

```bash
# Analysis
python scripts/code_quality_checker.py .
python scripts/review_report_generator.py --analyze

# Development
npm run dev && npm run build && npm run test && npm run lint
```

## Troubleshooting

Check `references/common_antipatterns.md` for common issues and troubleshooting guidance.

## Language-specific checklists

Per-language review checks extracted from `agents/3rdparty/code-reviewer.md`. Each file is self-contained.

| Language | Reference | Key concerns |
|---|---|---|
| TypeScript | `references/typescript-checklist.md` | `any` usage, `strict` config, floating Promises, null safety |
| Python | `references/python-checklist.md` | Mutable defaults, bare `except`, type hints, `eval`/`exec` |
| Rust | `references/rust-checklist.md` | `.unwrap()` outside tests, `unsafe` SAFETY comments, lifetimes |
| SQL | `references/sql-checklist.md` | Unbounded mutations, N+1 queries, missing indexes |

## Resources

- Pattern Reference: `references/code_review_checklist.md`
- Workflow Guide: `references/coding_standards.md`
- Technical Guide: `references/common_antipatterns.md`
- Tool Scripts: `scripts/` directory

## Done / Acceptance

- All findings are classified by severity (CRITICAL / HIGH / MEDIUM / LOW)
- Each finding includes risk explanation and a concrete fix suggestion
- Language-specific checklists consulted for files in TypeScript, Python, Rust, Go, or SQL
- Review closes with a summary: file count, finding counts by severity, and a merge recommendation
