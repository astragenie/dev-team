---
name: docker-expert
prompt_id: docker-expert
version: 1.0.0
tier: domain
description: Docker containerization expert covering multi-stage builds, image optimization, container security hardening, Docker Compose orchestration, and production deployment patterns — use when writing or reviewing Dockerfiles, solving container issues, or setting up container-based workflows.
source: davila7/claude-code-templates/cli-tool/components/skills/development/docker-expert
source_version: 2026-06-08
last_reviewed: 2026-06-08
owner: hero-crew
triggers: ["Docker", "Dockerfile", "docker-compose", "docker compose", "container", "containerize", "multi-stage build", "image optimization", "docker build", "docker run", "distroless", "alpine image", ".dockerignore", "docker network", "health check", "non-root user", "buildx", "BuildKit", "docker scout", "container security"]
---

# Docker Expert

Advanced Docker containerization expertise: Dockerfile optimization, security hardening,
multi-stage builds, Docker Compose orchestration, and production deployment patterns.

## When to use

Consult this skill when:
- Writing or reviewing Dockerfiles (multi-stage, base image selection, layer caching)
- Optimizing image size (distroless, Alpine, `--mount=type=cache`)
- Hardening container security (non-root user, secrets management, capability restrictions)
- Composing multi-service stacks with Docker Compose
- Diagnosing container issues (build slowness, image bloat, networking, restarts)
- Setting up development containers with hot reloading or debug ports
- Building multi-architecture images (`docker buildx`)

## Escalation — When to Recommend Another Expert

Stop and redirect when the issue requires:
- Kubernetes orchestration, pods, services, ingress → `kubernetes-expert`
- GitHub Actions CI/CD with containers → `github-actions-expert`
- AWS ECS/Fargate or cloud-specific container services → `devops-expert`
- Database containerization with complex persistence → `database-expert`

## Core Dockerfile Pattern

```dockerfile
# Stage 1: Install production deps
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runtime (minimal)
FROM node:18-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

## Security Essentials

- **Non-root user**: Always create a specific UID/GID and switch with `USER`
- **Secrets at build time**: Use `--mount=type=secret,id=...` (BuildKit), never `ENV`
- **Runtime secrets**: Use Docker Secrets (`/run/secrets/`), not environment variables
- **Layer hygiene**: Never `COPY` secrets; clean up in the same `RUN` layer

## Docker Compose: Production-Ready Pattern

```yaml
services:
  app:
    build:
      context: .
      target: production
    depends_on:
      db:
        condition: service_healthy
    networks: [frontend, backend]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 512M }
        reservations: { cpus: '0.25', memory: 256M }

networks:
  frontend: { driver: bridge }
  backend: { driver: bridge, internal: true }
```

Backend services should use `internal: true` networks — no direct external exposure.

## Common Issue Diagnostics

| Symptom | Root Cause | Fix |
|---|---|---|
| Slow builds (10+ min) | Poor layer order, no cache | Multi-stage + `.dockerignore` + dep caching |
| Image > 1 GB | Build tools in production stage | Distroless / Alpine + multi-stage |
| Security scan failures | Root exec, outdated base | Non-root user + `FROM ... AS deps` base updates |
| Service communication fail | Missing networks, wrong hostname | Custom networks + service name DNS |
| Hot reload fails in dev | Volume mounting order | Explicit volume mounts; use `target: development` |

## References

Detailed patterns and checklists in `references/`:

| Reference | Load when |
|---|---|
| [references/optimization-and-security.md](references/optimization-and-security.md) | Layer caching, distroless, build cache mounts, secrets patterns, multi-arch |
| [references/compose-and-workflow.md](references/compose-and-workflow.md) | Compose orchestration, dev workflow, resource limits, review checklists |

## Done / Acceptance

A Docker setup is ready when:
- Multi-stage build separates build and runtime environments
- Production stage runs as non-root user with specific UID/GID
- Secrets are NOT in environment variables or image layers
- `.dockerignore` excludes build artifacts, node_modules, and dev files
- `HEALTHCHECK` defined for all long-running services
- Backend networks use `internal: true`
- Image size is reasonable for the stack (Node Alpine: ~150-250MB, distroless: ~50-100MB)
- `docker-compose config` validates cleanly
- Resource limits set for production Compose services
