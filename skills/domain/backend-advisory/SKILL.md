---
name: backend-advisory
tier: domain
description: Comprehensive backend development skill for building scalable backend systems using NodeJS, Express, Go, Python, Postgres, GraphQL, REST APIs. Includes API scaffolding, database optimization, security implementation, and performance tuning. Use when designing APIs, optimizing database queries, implementing business logic, handling authentication/authorization, or reviewing backend code.
source: aitmpl/development/senior-backend
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: server-side code, API handler, data layer, database query, authentication, REST, GraphQL
---

# Backend Advisory

## When to use

- Designing or reviewing API endpoints and handlers
- Optimizing database queries or data layer patterns
- Implementing authentication, authorization, or session logic
- Debugging server-side performance or reliability issues
- Reviewing backend security practices

Complete toolkit for senior backend development with modern tools and best practices.

## Quick Start

```bash
# API scaffolding
python scripts/api_scaffolder.py <project-path> [options]

# Database migration and optimization
python scripts/database_migration_tool.py <target-path> [--verbose]

# API load testing
python scripts/api_load_tester.py [arguments] [options]
```

## Core Capabilities

### 1. Api Scaffolder

Automated tool for API scaffolding. Features: automated scaffolding, best practices built-in, configurable templates, quality checks.

### 2. Database Migration Tool

Comprehensive analysis and optimization tool. Features: deep analysis, performance metrics, recommendations, automated fixes.

### 3. Api Load Tester

Advanced tooling for load and performance testing. Features: expert-level automation, custom configurations, integration ready, production-grade output.

## Reference Documentation

- **Api Design Patterns** — `references/api_design_patterns.md`: patterns, code examples, best practices, anti-patterns, real-world scenarios.
- **Database Optimization Guide** — `references/database_optimization_guide.md`: step-by-step processes, optimization strategies, tool integrations, performance tuning.
- **Backend Security Practices** — `references/backend_security_practices.md`: technology stack details, configuration examples, integration patterns, security considerations.

## Tech Stack

**Languages:** TypeScript, JavaScript, Python, Go, Swift, Kotlin
**Frontend:** React, Next.js, React Native, Flutter
**Backend:** Node.js, Express, GraphQL, REST APIs
**Database:** PostgreSQL, Prisma, NeonDB, Supabase
**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, CircleCI
**Cloud:** AWS, GCP, Azure

## Development Workflow

1. **Setup:** `npm install` or `pip install -r requirements.txt`; copy `.env.example .env`
2. **Run analysis:** `python scripts/database_migration_tool.py .`
3. **Apply practices** from `references/api_design_patterns.md`, `references/database_optimization_guide.md`, `references/backend_security_practices.md`

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
python scripts/database_migration_tool.py .
python scripts/api_load_tester.py --analyze

# Deployment
docker build -t app:latest .
docker-compose up -d
kubectl apply -f k8s/
```

## Troubleshooting

### Common Issues

Check the comprehensive troubleshooting section in `references/backend_security_practices.md`.

### Getting Help

- Review reference documentation
- Check script output messages
- Consult tech stack documentation
- Review error logs

## Resources

- Pattern Reference: `references/api_design_patterns.md`
- Workflow Guide: `references/database_optimization_guide.md`
- Technical Guide: `references/backend_security_practices.md`
- Tool Scripts: `scripts/` directory

## Done / Acceptance

- API design is consistent with existing patterns and documented
- Database queries are optimized and validated against test data
- Authentication and input-validation logic is implemented and tested
- Security concerns (injection, over-exposure) are addressed
