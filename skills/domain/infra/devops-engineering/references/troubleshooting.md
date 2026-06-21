# Incident Response and Troubleshooting Reference

Production troubleshooting, incident response, log/metric correlation, container debugging, deployment rollbacks, and postmortem discipline.

> Folded source: `agents/3rdparty/devops-troubleshooter.md` (32 lines, incident response specialist)

## Incident response lifecycle

```
1. Gather facts  →  2. Form hypothesis  →  3. Test  →  4. Fix  →  5. Verify  →  6. Postmortem
```

**Never skip step 1.** Acting on assumption before gathering logs/metrics wastes time and risks compounding the incident.

## Step 1 — Gather facts first

Collect before doing anything:

```bash
# Pod state
kubectl get pods -n $NS -o wide
kubectl describe pod $POD -n $NS    # events section is critical
kubectl logs $POD -n $NS --previous # last crash's logs

# Resource pressure
kubectl top pods -n $NS
kubectl top nodes

# Recent events
kubectl get events -n $NS --sort-by='.lastTimestamp' | tail -20

# Service/endpoint connectivity
kubectl get svc,endpoints -n $NS
```

For non-k8s: `systemctl status <service>`, `journalctl -u <service> -n 100`, `dmesg | tail -30`.

## Step 2 — Common failure patterns and diagnostics

### CrashLoopBackOff

Causes (in order of frequency):
1. Application startup crash — check `kubectl logs $POD --previous`
2. Missing environment variable or secret — check `kubectl describe pod` for `Error: secret not found`
3. Liveness probe misconfigured — probe fires before app is ready
4. OOMKilled — check `kubectl describe pod` for `OOMKilled` reason; increase memory limit or fix leak

Diagnostic:
```bash
kubectl logs $POD -n $NS --previous 2>&1 | tail -50
kubectl describe pod $POD -n $NS | grep -A5 "Last State:"
```

### ImagePullBackOff / ErrImagePull

```bash
kubectl describe pod $POD -n $NS | grep -A5 "Failed to pull image"
# Causes: wrong tag, registry credentials missing, rate limit
kubectl create secret docker-registry regcred \
  --docker-server=$REGISTRY \
  --docker-username=$USER \
  --docker-password=$TOKEN
```

### Service unreachable (pod healthy, service 503)

```bash
# Check endpoint slice — if empty, selector mismatch
kubectl get endpoints $SVC -n $NS
# Test from inside cluster
kubectl run debug --rm -it --image=busybox -- wget -qO- http://$SVC.$NS.svc.cluster.local
# Check network policy blocks
kubectl get networkpolicy -n $NS
```

### High memory / CPU — profiling approach

1. `kubectl top pods -n $NS --sort-by=memory` — identify outlier
2. Check for memory leak: plot memory over time in Grafana; steady upward slope = leak
3. CPU spike: check `rate(process_cpu_seconds_total[5m])` in Prometheus; correlate with traffic spike
4. Enable Go pprof / JVM JFR / Node.js `--inspect` depending on runtime

### Deployment stuck (Progressing, never Available)

```bash
kubectl rollout status deployment/$DEPLOY -n $NS
kubectl rollout history deployment/$DEPLOY -n $NS
# If stuck on new pod creation:
kubectl get rs -n $NS  # check replica set state
kubectl describe rs $RS -n $NS
```

## Step 4 — Fix approaches

### Emergency rollback

```bash
# Kubernetes — roll back to previous revision
kubectl rollout undo deployment/$DEPLOY -n $NS
kubectl rollout status deployment/$DEPLOY -n $NS

# Helm — roll back to previous release
helm rollback $RELEASE 0 --namespace $NS   # 0 = previous release
helm status $RELEASE -n $NS

# Verify
kubectl get pods -n $NS -w
```

### Hotfix deploy (skip staging for production emergency)

Document the decision before acting. Escalate to incident commander. Apply fix directly:
```bash
kubectl set image deployment/$DEPLOY \
  $CONTAINER=$REGISTRY/$IMAGE:$HOTFIX_TAG \
  -n $NS
kubectl rollout status deployment/$DEPLOY -n $NS
```

### Log-based diagnosis (ELK / Datadog)

```
# Datadog: filter by service + error status last 30m
service:myapp status:error @http.status_code:[500 TO 599]

# ELK / Kibana: Lucene query
service:"myapp" AND level:"error" AND NOT message:"expected error"

# Correlate across services via trace_id
trace_id:"abc123def456"
```

## Step 5 — Verify fix

After applying fix:
1. Watch pod restarts drop to 0: `kubectl get pods -n $NS -w`
2. Check error rate drops in Prometheus: `rate(http_requests_total{status=~"5.."}[2m])`
3. Run smoke test against the affected endpoint
4. Confirm alert auto-resolves in Alertmanager (or manually resolve if confirmed fixed)

## Step 6 — Postmortem and follow-up

Produce within 48h of incident resolution:

- **Timeline**: precise sequence of events (alert fired → first responder → diagnosis steps → fix applied → resolution)
- **Root cause**: single sentence, not blame. "The deployment rolled out without a readiness probe, so traffic was routed to pods before they were healthy."
- **Contributing factors**: config gaps, missing alerts, process failures
- **Action items**: each item has an owner + due date

Postmortem template:
```
## Root cause
## Timeline
## Contributing factors
## What went well
## Action items
| Item | Owner | Due |
|------|-------|-----|
```

## Monitoring additions post-incident

After every significant incident, add monitoring to prevent recurrence:

```bash
# Add alert for the specific failure mode discovered
# Example: alert on pod restarts > N in 15m
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
spec:
  groups:
  - name: post-incident.rules
    rules:
    - alert: HighRestartRate
      expr: increase(kube_pod_container_status_restarts_total{namespace="$NS"}[15m]) > 3
      for: 0m
      labels: { severity: critical }
EOF
```

## Security scan commands (pre-deploy gate)

```bash
# Container image scanning
trivy image --exit-code 1 --severity HIGH,CRITICAL myapp:latest

# Kubernetes security benchmark
kube-bench run --targets node,policies,managedservices

# IaC security
tfsec terraform/
checkov -d terraform/

# Secret scanning
gitleaks detect --source . --verbose

# OWASP dependency check
npm audit --production
```

## Done / Acceptance (incident response)

- Root cause identified with supporting evidence (log lines, metrics, events)
- Fix verified: error rate back to baseline; no new crashes within 10m of fix
- Postmortem draft written within 48h
- At least one monitoring addition planned or implemented to detect the issue earlier next time
- Runbook updated if response steps were not previously documented
