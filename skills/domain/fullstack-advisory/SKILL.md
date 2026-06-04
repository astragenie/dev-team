---
name: fullstack-advisory
tier: domain
description: Comprehensive fullstack development skill for building complete web applications with React, Next.js, Node.js, GraphQL, and PostgreSQL. Includes project scaffolding, code quality analysis, architecture patterns, and complete tech stack guidance. Use when building new projects, analyzing code quality, implementing design patterns, or setting up development workflows.
source: aitmpl/development/senior-fullstack
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
---

# Fullstack Advisory

Complete toolkit for senior fullstack development with modern tools and best practices.

## Quick Start

```bash
# Fullstack scaffolding
python scripts/fullstack_scaffolder.py <project-path> [options]

# Project scaffolding
python scripts/project_scaffolder.py <target-path> [--verbose]

# Code quality analysis
python scripts/code_quality_analyzer.py [arguments] [options]
```

## Core Capabilities

### 1. Fullstack Scaffolder

Automated tool for fullstack scaffolding. Features: automated scaffolding, best practices built-in, configurable templates, quality checks.

### 2. Project Scaffolder

Comprehensive analysis and optimization tool. Features: deep analysis, performance metrics, recommendations, automated fixes.

### 3. Code Quality Analyzer

Advanced tooling for code quality. Features: expert-level automation, custom configurations, integration ready, production-grade output.

## Reference Documentation

- **Tech Stack Guide** — `references/tech_stack_guide.md`: patterns, code examples, best practices, anti-patterns, real-world scenarios.
- **Architecture Patterns** — `references/architecture_patterns.md`: step-by-step processes, optimization strategies, tool integrations, performance tuning.
- **Development Workflows** — `references/development_workflows.md`: technology stack details, configuration examples, integration patterns, security considerations.

## Tech Stack

**Languages:** TypeScript, JavaScript, Python, Go, Swift, Kotlin
**Frontend:** React, Next.js, React Native, Flutter
**Backend:** Node.js, Express, GraphQL, REST APIs
**Database:** PostgreSQL, Prisma, NeonDB, Supabase
**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, CircleCI
**Cloud:** AWS, GCP, Azure

## Development Workflow

1. **Setup:** `npm install` or `pip install -r requirements.txt`; copy `.env.example .env`
2. **Run analysis:** `python scripts/project_scaffolder.py .`
3. **Apply practices** from `references/tech_stack_guide.md`, `references/architecture_patterns.md`, `references/development_workflows.md`

## Quality Practices

### Code Quality
- Follow established patterns
- Write comprehensive tests
- Document decisions
- Review regularly

### Performance
- Measure before optimizing
- Use appropriate caching
- Optimize critical paths
- Monitor in production

### Security
- Validate all inputs
- Use parameterized queries
- Implement proper authentication
- Keep dependencies updated

### Maintainability
- Write clear code
- Use consistent naming
- Add helpful comments
- Keep it simple

## Common Commands

```bash
# Development
npm run dev
npm run build
npm run test
npm run lint

# Analysis
python scripts/project_scaffolder.py .
python scripts/code_quality_analyzer.py --analyze

# Deployment
docker build -t app:latest .
docker-compose up -d
kubectl apply -f k8s/
```

## Troubleshooting

### Common Issues

Check the comprehensive troubleshooting section in `references/development_workflows.md`.

### Getting Help

- Review reference documentation
- Check script output messages
- Consult tech stack documentation
- Review error logs

## Resources

- Pattern Reference: `references/tech_stack_guide.md`
- Workflow Guide: `references/architecture_patterns.md`
- Technical Guide: `references/development_workflows.md`
- Tool Scripts: `scripts/` directory
