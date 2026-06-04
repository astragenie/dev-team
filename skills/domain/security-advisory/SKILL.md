---
name: security-advisory
tier: domain
description: Comprehensive security engineering skill for application security, penetration testing, security architecture, and compliance auditing. Includes security assessment tools, threat modeling, crypto implementation, and security automation. Use when designing security architecture, conducting penetration tests, implementing cryptography, or performing security audits.
source: aitmpl/development/senior-security
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: auth, crypto, secrets, input validation, OWASP, threat model, SQL injection, XSS
---

# Security Advisory

## When to use

- Designing or reviewing authentication and authorization flows
- Implementing cryptography, secrets management, or token handling
- Auditing input handling for injection or XSS vulnerabilities
- Conducting a threat model or OWASP-aligned security review
- Evaluating compliance requirements (GDPR, SOC 2, PCI)

Complete toolkit for senior security engineering with modern tools and best practices.

## Quick Start

```bash
# Threat modeling
python scripts/threat_modeler.py <project-path> [options]

# Security audit
python scripts/security_auditor.py <target-path> [--verbose]

# Penetration test automation
python scripts/pentest_automator.py [arguments] [options]
```

## Core Capabilities

### 1. Threat Modeler

Automated tool for threat modeling. Features: automated scaffolding, best practices built-in, configurable templates, quality checks.

### 2. Security Auditor

Comprehensive analysis and optimization tool. Features: deep analysis, performance metrics, recommendations, automated fixes.

### 3. Pentest Automator

Advanced tooling for penetration testing. Features: expert-level automation, custom configurations, integration ready, production-grade output.

## Reference Documentation

- **Security Architecture Patterns** — `references/security_architecture_patterns.md`: patterns, code examples, best practices, anti-patterns, real-world scenarios.
- **Penetration Testing Guide** — `references/penetration_testing_guide.md`: step-by-step processes, optimization strategies, tool integrations, performance tuning.
- **Cryptography Implementation** — `references/cryptography_implementation.md`: technology stack details, configuration examples, integration patterns, security considerations.

## Tech Stack

**Languages:** TypeScript, JavaScript, Python, Go, Swift, Kotlin
**Frontend:** React, Next.js, React Native, Flutter
**Backend:** Node.js, Express, GraphQL, REST APIs
**Database:** PostgreSQL, Prisma, NeonDB, Supabase
**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, CircleCI
**Cloud:** AWS, GCP, Azure

## Development Workflow

1. **Setup:** `npm install` or `pip install -r requirements.txt`; copy `.env.example .env`
2. **Run analysis:** `python scripts/security_auditor.py .`
3. **Apply practices** from `references/security_architecture_patterns.md`, `references/penetration_testing_guide.md`, `references/cryptography_implementation.md`

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
python scripts/security_auditor.py .
python scripts/pentest_automator.py --analyze

# Deployment
docker build -t app:latest .
docker-compose up -d
kubectl apply -f k8s/
```

## Troubleshooting

### Common Issues

Check the comprehensive troubleshooting section in `references/cryptography_implementation.md`.

### Getting Help

- Review reference documentation
- Check script output messages
- Consult tech stack documentation
- Review error logs

## Resources

- Pattern Reference: `references/security_architecture_patterns.md`
- Workflow Guide: `references/penetration_testing_guide.md`
- Technical Guide: `references/cryptography_implementation.md`
- Tool Scripts: `scripts/` directory

## Done / Acceptance

- Identified vulnerabilities are categorized by severity and each has a remediation action
- Threat model covers entry points, trust boundaries, and data flows
- Authentication and authorization paths are verified against the threat model
- All high/critical findings are resolved or carry an explicit accepted-risk note
