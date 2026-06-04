---
name: frontend-advisory
tier: domain
description: Comprehensive frontend development skill for building modern, performant web applications using ReactJS, NextJS, TypeScript, Tailwind CSS. Includes component scaffolding, performance optimization, bundle analysis, and UI best practices. Use when developing frontend features, optimizing performance, implementing UI/UX designs, managing state, or reviewing frontend code.
source: aitmpl/development/senior-frontend
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
---

# Frontend Advisory

Complete toolkit for senior frontend development with modern tools and best practices.

## Quick Start

```bash
# Component generation
python scripts/component_generator.py <project-path> [options]

# Bundle analysis
python scripts/bundle_analyzer.py <target-path> [--verbose]

# Frontend scaffolding
python scripts/frontend_scaffolder.py [arguments] [options]
```

## Core Capabilities

### 1. Component Generator

Automated tool for component generation. Features: automated scaffolding, best practices built-in, configurable templates, quality checks.

### 2. Bundle Analyzer

Comprehensive analysis and optimization tool. Features: deep analysis, performance metrics, recommendations, automated fixes.

### 3. Frontend Scaffolder

Advanced tooling for project scaffolding. Features: expert-level automation, custom configurations, integration ready, production-grade output.

## Reference Documentation

- **React Patterns** — `references/react_patterns.md`: patterns, code examples, best practices, anti-patterns, real-world scenarios.
- **Nextjs Optimization Guide** — `references/nextjs_optimization_guide.md`: step-by-step processes, optimization strategies, tool integrations, performance tuning.
- **Frontend Best Practices** — `references/frontend_best_practices.md`: technology stack details, configuration examples, integration patterns, security considerations.

## Tech Stack

**Languages:** TypeScript, JavaScript, Python, Go, Swift, Kotlin
**Frontend:** React, Next.js, React Native, Flutter
**Backend:** Node.js, Express, GraphQL, REST APIs
**Database:** PostgreSQL, Prisma, NeonDB, Supabase
**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, CircleCI
**Cloud:** AWS, GCP, Azure

## Development Workflow

1. **Setup:** `npm install` or `pip install -r requirements.txt`; copy `.env.example .env`
2. **Run analysis:** `python scripts/bundle_analyzer.py .`
3. **Apply practices** from `references/react_patterns.md`, `references/nextjs_optimization_guide.md`, `references/frontend_best_practices.md`

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
python scripts/bundle_analyzer.py .
python scripts/frontend_scaffolder.py --analyze

# Deployment
docker build -t app:latest .
docker-compose up -d
kubectl apply -f k8s/
```

## Troubleshooting

### Common Issues

Check the comprehensive troubleshooting section in `references/frontend_best_practices.md`.

### Getting Help

- Review reference documentation
- Check script output messages
- Consult tech stack documentation
- Review error logs

## Resources

- Pattern Reference: `references/react_patterns.md`
- Workflow Guide: `references/nextjs_optimization_guide.md`
- Technical Guide: `references/frontend_best_practices.md`
- Tool Scripts: `scripts/` directory
