---
name: architecture-advisory
tier: domain
description: Comprehensive software architecture skill for designing scalable, maintainable systems using ReactJS, NextJS, NodeJS, Express, React Native, Swift, Kotlin, Flutter, Postgres, GraphQL, Go, Python. Includes architecture diagram generation, system design patterns, tech stack decision frameworks, and dependency analysis. Use when designing system architecture, making technical decisions, creating architecture diagrams, evaluating trade-offs, or defining integration patterns.
source: aitmpl/development/senior-architect
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
---

# Architecture Advisory

Complete toolkit for software architecture with modern tools and best practices.

## Quick Start

```bash
# Architecture diagram generation
python scripts/architecture_diagram_generator.py <project-path> [options]

# Project architecture analysis
python scripts/project_architect.py <target-path> [--verbose]

# Dependency analysis
python scripts/dependency_analyzer.py [arguments] [options]
```

## Core Capabilities

### 1. Architecture Diagram Generator

Automated tool for architecture diagram generation. Features: automated scaffolding, best practices built-in, configurable templates, quality checks.

### 2. Project Architect

Comprehensive analysis and optimization tool. Features: deep analysis, performance metrics, recommendations, automated fixes.

### 3. Dependency Analyzer

Advanced tooling for dependency analysis. Features: expert-level automation, custom configurations, integration ready, production-grade output.

## Reference Documentation

- **Architecture Patterns** — `references/architecture_patterns.md`: patterns, code examples, best practices, anti-patterns, real-world scenarios.
- **System Design Workflows** — `references/system_design_workflows.md`: step-by-step processes, optimization strategies, tool integrations.
- **Tech Decision Guide** — `references/tech_decision_guide.md`: technology stack details, configuration examples, integration patterns, security considerations.

## Tech Stack

**Languages:** TypeScript, JavaScript, Python, Go, Swift, Kotlin
**Frontend:** React, Next.js, React Native, Flutter
**Backend:** Node.js, Express, GraphQL, REST APIs
**Database:** PostgreSQL, Prisma, NeonDB, Supabase
**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, CircleCI
**Cloud:** AWS, GCP, Azure

## Development Workflow

1. **Setup:** `npm install` or `pip install -r requirements.txt`; copy `.env.example .env`
2. **Run analysis:** `python scripts/project_architect.py .`
3. **Apply practices** from `references/architecture_patterns.md`, `references/system_design_workflows.md`, `references/tech_decision_guide.md`

## Common Commands

```bash
python scripts/project_architect.py .
python scripts/dependency_analyzer.py --analyze
docker build -t app:latest . && docker-compose up -d
```

## Resources

- Pattern Reference: `references/architecture_patterns.md`
- Workflow Guide: `references/system_design_workflows.md`
- Technical Guide: `references/tech_decision_guide.md`
- Tool Scripts: `scripts/` directory

## See also

- **Database architecture** (schema design, migrations, technology selection, partitioning) → `skills/domain/database-architecture/`
- **Cloud architecture** (multi-cloud, landing zones, IAM, DR, cost optimization) → `skills/domain/cloud-architecture/`
