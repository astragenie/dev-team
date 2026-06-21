# Docker Expert — Compose Orchestration & Development Workflow

Reference for `skills/domain/infra/docker-expert/`.

---

## Full Production Compose Example

```yaml
version: '3.8'
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
      start_period: 40s
    deploy:
      resources:
        limits: { cpus: '0.5', memory: 512M }
        reservations: { cpus: '0.25', memory: 256M }
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB_FILE: /run/secrets/db_name
      POSTGRES_USER_FILE: /run/secrets/db_user
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets: [db_name, db_user, db_password]
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [backend]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  frontend: { driver: bridge }
  backend: { driver: bridge, internal: true }

volumes:
  postgres_data:

secrets:
  db_name: { external: true }
  db_user: { external: true }
  db_password: { external: true }
```

## Development Override Pattern

```yaml
# docker-compose.override.yml (auto-loaded in dev)
services:
  app:
    build:
      target: development
    volumes:
      - .:/app
      - /app/node_modules   # Prevent host node_modules from overriding
    environment:
      - NODE_ENV=development
      - DEBUG=app:*
    ports:
      - "9229:9229"   # Debug port
    command: npm run dev
```

## Health Check Strategies

```dockerfile
# Custom health check script
COPY health-check.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/health-check.sh
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD ["/usr/local/bin/health-check.sh"]
```

Use `start_period` for apps with slow startup (e.g., JVM, migrations).

---

## Compose Review Checklist

**Dependencies & Networking:**
- [ ] `depends_on` with `condition: service_healthy` (not just `depends_on: [db]`)
- [ ] Backend services on `internal: true` network
- [ ] Only public-facing ports exposed on host

**Data & Secrets:**
- [ ] Named volumes for all persistent data (not anonymous)
- [ ] Secrets via Docker Secrets (`/run/secrets/`) not `environment:`
- [ ] Volume strategies match backup/restore requirements

**Resilience:**
- [ ] `restart_policy` defined for production services
- [ ] Resource `limits` AND `reservations` set
- [ ] `HEALTHCHECK` on every long-running service

**Environment Management:**
- [ ] Dev overrides in `docker-compose.override.yml` (auto-loaded)
- [ ] Production config in separate `docker-compose.prod.yml`
- [ ] No dev tools / bind mounts in production target

---

## Validation Commands

```bash
# Validate compose config
docker-compose config

# Build and security validation
docker build --no-cache -t test-build .
docker history test-build --no-trunc | head -10
docker scout quickview test-build   # Requires Docker Scout

# Runtime validation
docker run --rm -d --name val-test test-build
docker exec val-test ps aux | head -5
docker stop val-test
```
