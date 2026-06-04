# CI/CD Pipeline Reference

Patterns and decision rules for authoring, reviewing, and debugging CI/CD pipelines across GitHub Actions, GitLab CI, Azure DevOps, and Jenkins.

## Pipeline stage model

A well-structured pipeline has five ordered gates. Each gate runs only if the previous passes:

```
test → build → [deploy-staging] → [deploy-production] → verify
```

- **test**: lint, unit, integration, security audit, code-quality scan
- **build**: compile / containerize; push artifact to registry; tag with commit SHA
- **deploy-staging**: triggered on `develop` / feature branches; smoke-test after
- **deploy-production**: triggered on `main`; requires all prior gates + health check
- **verify**: post-deploy health probe (smoke test, canary metric check, readiness probe)

## GitHub Actions — key patterns

### Job dependency chaining

```yaml
jobs:
  test: { ... }
  build:
    needs: test
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    needs: build
    environment: staging
  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: build
    environment: production
```

### Docker build + push with layer caching

```yaml
- uses: docker/setup-buildx-action@v3
- uses: docker/login-action@v3
  with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
- uses: docker/metadata-action@v5
  id: meta
  with:
    images: ghcr.io/${{ github.repository }}
    tags: |
      type=sha,prefix=sha-
      type=raw,value=latest,enable={{is_default_branch}}
- uses: docker/build-push-action@v5
  with:
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
    platforms: linux/amd64,linux/arm64
```

### Service containers for integration tests

```yaml
services:
  postgres:
    image: postgres:14
    env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: test_db }
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

### Security gates in test job

```yaml
- name: Dependency audit
  run: npm audit --production
- name: Secret scan
  run: gitleaks detect --source . --verbose
- name: Code quality
  uses: sonarcloud/sonarcloud-github-action@master
  env: { SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }} }
```

## Artifact management

- Tag images with commit SHA (`sha-<short>`) plus semantic tag (`latest`, `v1.2.3`). Never deploy `latest` to production — always pin to a digest or SHA tag.
- Store images in container registry (GHCR, ECR, ACR); never bake secrets into image layers.
- For npm/pip/Maven packages: publish to a private registry; pin lockfile in CI (`npm ci`, `pip install --require-hashes`).

## Deployment strategies (pipeline perspective)

| Strategy | When to use | Pipeline trigger |
|---|---|---|
| Rolling update | Low-risk, stateless services | default `helm upgrade` |
| Blue-green | Zero-downtime, easy rollback | `helm upgrade --install myapp-green` → traffic switch → `helm uninstall myapp-blue` |
| Canary | High-risk, gradual risk mitigation | Istio VirtualService weight split (e.g. 10% new / 90% stable) |

Blue-green script skeleton:

```bash
CURRENT=$(kubectl get svc myapp -n prod -o jsonpath='{.spec.selector.color}')
NEW=$([ "$CURRENT" = "blue" ] && echo "green" || echo "blue")
helm upgrade --install myapp-$NEW ./chart --set deployment.color=$NEW --wait
kubectl wait --for=condition=ready pod -l color=$NEW -n prod --timeout=300s
kubectl patch svc myapp -n prod -p "{\"spec\":{\"selector\":{\"color\":\"$NEW\"}}}"
helm uninstall myapp-$CURRENT --namespace prod || true
```

## Anti-patterns and pitfalls

- **No stage separation** — merging build + test into one job hides which step failed and prevents reuse of build artifacts across environments.
- **Hardcoded credentials in workflow YAML** — use `secrets.*` or OIDC federated identity; never inline tokens.
- **`push: true` on every branch** — push images only on `main` or release branches; tag and push on PRs wastes registry storage and creates security noise.
- **Missing health checks after deploy** — always run a smoke test or readiness probe after each deploy stage before gating the next one.
- **`sleep 30` as a readiness wait** — use `kubectl wait --for=condition=ready` or `curl --retry N --retry-delay S` instead; sleeps are flaky.
- **No rollback path** — every deployment stage must have a documented rollback step in the pipeline or runbook.

## Environment management

- Store environment-specific values in GitHub Environments (`settings → Environments`) with protection rules (required reviewers for `production`).
- Use environment-scoped secrets; avoid org-level secrets for environment-specific credentials.
- Promotion must be gated: staging deploy must succeed + smoke tests pass before production job runs.

## Multi-platform builds

Build for `linux/amd64,linux/arm64` using `docker/setup-buildx-action`. Reduces image-mismatch incidents on ARM-based nodes (Apple Silicon dev machines, AWS Graviton).

## Done / Acceptance (CI/CD)

- Pipeline YAML passes `actionlint` / `gitlab-ci-lint` / equivalent linter
- Each stage fails the pipeline on non-zero exit; no `|| true` without explicit justification
- Secrets accessed via `${{ secrets.* }}` or OIDC; no plaintext credentials in YAML
- Smoke test runs after every deploy stage; failure blocks promotion
- Build artifact tagged with commit SHA; `latest` tag only on default branch
