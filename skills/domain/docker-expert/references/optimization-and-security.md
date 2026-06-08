# Docker Expert — Optimization & Security Patterns

Reference for `skills/domain/docker-expert/`.

---

## Layer Caching Optimization

Order `COPY` + `RUN` instructions from least-to-most-frequently-changed:

```dockerfile
# GOOD: deps change rarely; source changes often
COPY package*.json ./
RUN npm ci
COPY src/ ./src/

# BAD: invalidates dep cache on every source change
COPY . .
RUN npm ci
```

## Build Cache Mounts (BuildKit)

```dockerfile
# Cache npm downloads across builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Cache pip downloads
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
```

## Build-Time Secrets (BuildKit)

```dockerfile
# Never use ARG/ENV for secrets — they appear in image history
RUN --mount=type=secret,id=api_key \
    API_KEY=$(cat /run/secrets/api_key) && \
    curl -H "Authorization: $API_KEY" https://example.com/setup
```

Invoke with: `docker build --secret id=api_key,src=.env.secret .`

## Distroless / Minimal Images

```dockerfile
# Minimal Node.js production image
FROM gcr.io/distroless/nodejs18-debian11
COPY --from=build /app/dist /app
COPY --from=build /app/node_modules /app/node_modules
WORKDIR /app
CMD ["index.js"]
```

**Size comparison (Node.js app):**
| Base | Typical Size |
|---|---|
| `node:18` | ~1 GB |
| `node:18-alpine` | ~150-250 MB |
| `gcr.io/distroless/nodejs18` | ~50-100 MB |
| `scratch` (static binary) | ~10-20 MB |

## Multi-Architecture Builds

```bash
# Create and use a multiarch builder
docker buildx create --name multiarch-builder --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t myapp:latest --push .
```

## Security Hardening Checklist

- [ ] Non-root user created with specific UID/GID (`addgroup` + `adduser`)
- [ ] `USER <uid>` directive present before `CMD`/`ENTRYPOINT`
- [ ] No secrets in `ENV`, `ARG`, or image layers
- [ ] Base images pinned to specific digest or tag (not `latest`)
- [ ] `HEALTHCHECK` defined
- [ ] Only necessary ports `EXPOSE`d
- [ ] Read-only root filesystem where possible (`--read-only` at runtime)
- [ ] Capabilities dropped at runtime (`--cap-drop=ALL --cap-add=<minimal>`)

## .dockerignore Essentials

```
node_modules
.git
.env*
dist
*.log
*.md
.DS_Store
coverage
__pycache__
*.pyc
```

A missing or incomplete `.dockerignore` is the most common cause of large build contexts
and inadvertent secret inclusion in images.
