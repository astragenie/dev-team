# Container Orchestration Reference

Kubernetes deployments, Helm chart patterns, HPA, pod security, network policies, and rolling vs blue-green deployment mechanics.

## Kubernetes deployment anatomy

### Deployment manifest checklist

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%   # allow 25% pods down during update
      maxSurge: 25%          # allow 25% extra pods during update
  template:
    metadata:
      annotations:
        # Forces re-deployment when config or secrets change
        checksum/config: {{ include ".../configmap.yaml" . | sha256sum }}
        checksum/secret: {{ include ".../secret.yaml" . | sha256sum }}
    spec:
      serviceAccountName: {{ include "myapp.serviceAccountName" . }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
        - securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: [ALL] }
          livenessProbe:
            httpGet: { path: /health, port: http }
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet: { path: /ready, port: http }
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits:   { cpu: 500m, memory: 512Mi }
          volumeMounts:
            - { name: tmp, mountPath: /tmp }
            - { name: logs, mountPath: /app/logs }
      volumes:
        - { name: tmp, emptyDir: {} }
        - { name: logs, emptyDir: {} }
```

Key rules:
- Always set `requests` and `limits` — missing limits cause OOM on noisy nodes
- `readOnlyRootFilesystem: true` requires explicit `emptyDir` mounts for writeable paths
- Liveness probe `initialDelaySeconds` must exceed startup time; too short → crash loop
- Readiness probe governs traffic routing; failing readiness removes pod from service endpoint

## HPA (Horizontal Pod Autoscaler)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
    - type: Resource
      resource:
        name: memory
        target: { type: Utilization, averageUtilization: 80 }
```

HPA decisions:
- `minReplicas: 2` — never single-instance production deployments; one pod failure = outage
- CPU target 70% leaves headroom before throttling under spike
- For latency-sensitive services, add custom metrics (request queue depth, P95 latency) via Prometheus adapter

## Namespace and RBAC

```bash
kubectl create namespace myapp-prod
kubectl create serviceaccount myapp -n myapp-prod

# Least-privilege role binding
kubectl create role myapp-role --verb=get,list,watch --resource=pods,services -n myapp-prod
kubectl create rolebinding myapp-binding --role=myapp-role --serviceaccount=myapp-prod:myapp -n myapp-prod
```

Never use `cluster-admin` for application service accounts. Namespace-scoped roles only.

## Network policies

Default-deny then allow explicitly:

```yaml
# Default deny all ingress/egress in namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: myapp-prod
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# Allow ingress from ingress controller only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-controller
  namespace: myapp-prod
spec:
  podSelector:
    matchLabels: { app: myapp }
  ingress:
    - from:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: ingress-nginx }
      ports:
        - port: 8080
```

## Deployment strategy mechanics

### Rolling update (default)

Kubernetes manages the rollout: creates new pods, waits for readiness, then terminates old pods — respecting `maxUnavailable` and `maxSurge`. Monitor:
```bash
kubectl rollout status deployment/myapp -n prod
```

### Blue-green (Helm + service selector)

```bash
# Deploy green alongside blue
helm upgrade --install myapp-green ./chart \
  --namespace prod \
  --set image.tag=$NEW_TAG \
  --set deployment.color=green \
  --wait

# Health check on green pods
kubectl wait --for=condition=ready pod -l color=green -n prod --timeout=300s

# Switch traffic
kubectl patch svc myapp -n prod -p '{"spec":{"selector":{"color":"green"}}}'

# Remove blue after validation window
sleep 60  # or run smoke tests
helm uninstall myapp-blue --namespace prod
```

### Canary with Istio

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
spec:
  http:
    - match:
        - headers: { canary: { exact: "true" } }
      route:
        - destination: { host: myapp-svc, subset: canary }
    - route:
        - destination: { host: myapp-svc, subset: stable }
          weight: 90
        - destination: { host: myapp-svc, subset: canary }
          weight: 10
```

Canary validation: monitor error rate and P95 latency on canary subset in Grafana for 15–30 min before shifting more traffic. Automate with Argo Rollouts if available.

## Pod disruption budgets

Prevent cluster operations from taking down too many pods at once:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: myapp-pdb
spec:
  minAvailable: 2   # or maxUnavailable: 1
  selector:
    matchLabels: { app: myapp }
```

Required for: node upgrades, cluster autoscaler scale-down, `kubectl drain`.

## Secret management

```yaml
# Reference secrets from pod env (never hardcode)
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: myapp-secret
        key: database-url
  - name: REDIS_URL
    valueFrom:
      secretKeyRef:
        name: myapp-secret
        key: redis-url
```

Use External Secrets Operator or Sealed Secrets for GitOps-friendly secret management. Never commit raw Kubernetes Secrets to git — they are only base64 encoded, not encrypted.

## Anti-patterns

- **No resource limits** — unbounded memory leads to OOM evictions and noisy-neighbor problems
- **Image tag `latest` in production** — unpinned image means rollout can pull a different image than tested; always use digest or SHA tag
- **Missing PodDisruptionBudget** — node drain can kill all replicas simultaneously
- **`hostNetwork: true` or `hostPID: true`** — breaks pod isolation; security incident waiting to happen
- **Secrets as ConfigMaps** — ConfigMaps are not encrypted at rest; use Secrets with encryption enabled

## Done / Acceptance (orchestration)

- Deployment has liveness + readiness probes with appropriate `initialDelaySeconds`
- Resources `requests` and `limits` set on all containers
- HPA configured for production deployments with `minReplicas >= 2`
- PodDisruptionBudget present for stateful or latency-critical services
- NetworkPolicy restricts ingress to known sources; default-deny applied in namespace
- No `latest` image tags in production manifests; SHA or versioned tag required
- Rollback tested: `kubectl rollout undo` or `helm rollback` verified before go-live
