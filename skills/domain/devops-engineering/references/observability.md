# Observability Reference

Patterns for Prometheus/Grafana stacks, alerting rules, distributed tracing, and log aggregation (ELK/Datadog).

## Observability pillars

| Pillar | Tool examples | Purpose |
|---|---|---|
| Metrics | Prometheus + Grafana, Datadog | Time-series data, SLIs, dashboards |
| Logs | ELK stack, Datadog Logs, Loki | Event records, error traces, audit trails |
| Traces | Jaeger, Zipkin, Datadog APM | Request flow across services |
| Alerts | Alertmanager, PagerDuty, OpsGenie | Automated incident notification |

Wire all four before a service goes to production.

## Prometheus + Grafana on Kubernetes

### Prometheus Helm values (kube-prometheus-stack)

```yaml
prometheus:
  prometheusSpec:
    retention: 30d
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi
    additionalScrapeConfigs:
      - job_name: 'kubernetes-pods'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true

grafana:
  persistence:
    enabled: true
    storageClassName: gp3
    size: 10Gi
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: default
          type: file
          options:
            path: /var/lib/grafana/dashboards/default
  dashboards:
    default:
      kubernetes-cluster: { gnetId: 7249, datasource: Prometheus }
      node-exporter:      { gnetId: 1860, datasource: Prometheus }
```

Annotate pods to opt into scraping:
```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9090"
    prometheus.io/path: "/metrics"
```

## Application alert rules (PrometheusRule)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: application-alerts
spec:
  groups:
  - name: application.rules
    rules:
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High error rate: {{ $value }} req/s"

    - alert: HighP95Latency
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "P95 latency {{ $value }}s exceeds 500ms"

    - alert: PodCrashLooping
      expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Pod {{ $labels.pod }} crash-looping in {{ $labels.namespace }}"
```

## SLI / SLO alerting model

Define SLIs before adding ad-hoc alerts:

| SLI | Prometheus metric | Typical SLO |
|---|---|---|
| Availability | `rate(http_requests_total{status!~"5.."}[5m]) / rate(http_requests_total[5m])` | 99.9% |
| Latency (P95) | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` | < 500ms |
| Error rate | `rate(http_requests_total{status=~"5.."}[5m])` | < 0.1 req/s |

Alert on error budget burn rate, not raw thresholds — burn-rate alerting catches both fast burns (high severity) and slow burns (warning).

## Alertmanager routing

```yaml
# alertmanager.yml
route:
  group_by: ['alertname', 'namespace']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: default
  routes:
    - match: { severity: critical }
      receiver: pagerduty
    - match: { severity: warning }
      receiver: slack

receivers:
  - name: pagerduty
    pagerduty_configs:
      - service_key: $PAGERDUTY_KEY
  - name: slack
    slack_configs:
      - api_url: $SLACK_WEBHOOK
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
```

## Log aggregation

### ELK stack essentials

- Ship logs with Filebeat or Fluentd → Logstash (optional transform) → Elasticsearch → Kibana
- Structured JSON logs: always include `timestamp`, `level`, `service`, `trace_id`, `request_id`
- Index lifecycle management (ILM): hot (7d) → warm (23d) → cold (60d) → delete; prevents disk runaway

### Datadog log patterns

- Enable APM trace correlation: `DD_LOGS_INJECTION=true` propagates `trace_id` into logs automatically
- Use log facets for cardinality control; avoid logging unbounded user-input strings
- Reserved attributes: `timestamp`, `status`, `host`, `service`, `source` — map your log fields to these

## Distributed tracing

- Instrument service entry/exit points with OpenTelemetry SDK; avoid proprietary vendor-lock instrumentation at the code level
- Propagate W3C `traceparent` header across service boundaries
- Sample rate: 100% in staging, 1–10% in production for high-traffic paths; 100% for error paths

## Done / Acceptance (observability)

- Service exposes `/metrics` endpoint consumed by Prometheus
- Dashboards cover error rate, latency (P50/P95/P99), saturation, traffic (USE/RED method)
- At least one alert fires on simulated high error rate before declaring "monitoring complete"
- Logs are structured JSON with `trace_id` present for all user-initiated requests
- Alert routing verified: test alert reaches on-call channel before go-live
