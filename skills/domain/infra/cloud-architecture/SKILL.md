---
name: cloud-architecture
prompt_id: cloud-architecture
version: 1.0.0
tier: domain
description: Multi-cloud infrastructure design, landing zones, network topology, IAM, cost optimization, disaster recovery, and Well-Architected Framework guidance across AWS, Azure, and GCP.
source: aitmpl/devops-infrastructure/cloud-architect
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: ["cloud", "AWS", "Azure", "GCP", "multi-cloud", "VPC", "landing zone", "IAM", "multi-region", "disaster recovery", "RTO", "RPO", "cloud migration", "cost optimization", "FinOps", "serverless", "container", "kubernetes", "EKS", "AKS", "GKE", "CDN", "load balancer", "auto-scaling", "reserved instance", "spot instance", "zero-trust", "compliance", "HIPAA", "SOC2"]
---

# Cloud Architecture

Design and optimization guidance for cloud infrastructure across AWS, Azure, and GCP: landing
zones, network topology, IAM, cost optimization, disaster recovery, and migration strategies.

## When to use

Consult this skill when:
- Designing a new cloud environment (landing zone, account structure, network topology)
- Planning a cloud migration (lift-and-shift, re-platform, re-architect)
- Implementing multi-region or multi-cloud resilience strategies
- Optimizing cloud spend (right-sizing, reserved capacity, Spot/preemptible, FinOps)
- Designing security controls (zero-trust, IAM, network segmentation, compliance)
- Planning disaster recovery (RTO/RPO definitions, failover automation, runbooks)
- Choosing compute patterns (containers, serverless, VMs, HPC, GPU workloads)

## Core principles

- **Well-Architected Framework** — evaluate every design against the six pillars: operational excellence, security, reliability, performance efficiency, cost optimization, sustainability.
- **Security by design** — zero-trust network model, encryption at rest and in transit, least-privilege IAM, compliance automation from day one.
- **Infrastructure as Code** — all resources versioned and reproducible; no manual console changes in production environments.
- **Design for failure** — assume component failure; design for graceful degradation, automated failover, and recovery without human intervention.
- **Cost accountability** — tag every resource; implement budget alerts; right-size before reserving capacity.
- **Iterate continuously** — pilot workloads first; measure; then expand to production baseline.

## Multi-cloud strategy

- **Provider selection** — match workload characteristics and data-sovereignty requirements to provider strengths.
- **Vendor lock-in mitigation** — prefer open APIs and portable runtimes (containers, Kubernetes, Terraform); abstract provider-specific services behind thin adapter layers.
- **Data sovereignty** — map regulatory boundaries (GDPR, HIPAA, data residency laws) to region and account structure before designing.
- **Unified monitoring** — single observability plane (Datadog, Grafana Cloud, or native cross-account dashboards) across providers.
- **Cost arbitrage** — evaluate Spot/preemptible instances for fault-tolerant and batch workloads (50–70% discount).

## Landing zone design

- **Account / subscription structure** — separate production, staging, and development into distinct accounts/subscriptions; enforce via AWS Organizations / Azure Management Groups.
- **Network topology** — hub-and-spoke VPC/VNet; shared services hub (DNS, monitoring, security); spoke per environment or workload.
- **Identity management** — federate IdP (Entra ID, Okta) with cloud IAM; enforce MFA for console access; use role-based access with short-lived credentials.
- **Security baselines** — enable CloudTrail / Activity Log; enable GuardDuty / Defender for Cloud; enforce SCPs / Azure Policy from day one.
- **Cost allocation** — mandatory tagging policy: environment, team, product; linked accounts / subscriptions per billing unit.
- **Tagging strategy** — enforce at provisioning time via policy; tag drift is the primary cause of unattributed spend.

## Network architecture

- **VPC/VNet design** — `/16` CIDR for the VPC; `/24` subnets per AZ/zone; reserve `/22` for future expansion.
- **Subnet tiers** — public (load balancers, NAT gateways), private (application), isolated (databases); no direct internet route for isolated tier.
- **Security groups / NSGs** — deny-by-default; allow only named ports from named sources; no `0.0.0.0/0` on inbound except load balancers.
- **Load balancers** — ALB/Application Gateway for HTTP/S; NLB/Azure LB for TCP; CDN (CloudFront, Azure Front Door, Cloud CDN) for static assets and global acceleration.
- **Connectivity** — VPN for low-volume hybrid; Direct Connect / ExpressRoute for production hybrid; PrivateLink / Private Endpoint for SaaS integrations.

## Compute patterns

| Pattern | Use when |
|---|---|
| Containers (ECS/AKS/GKE) | Stateless services, blue-green deployments, cost-efficient scaling |
| Serverless (Lambda/Functions) | Event-driven, short-duration, variable-load workloads |
| VMs + Auto-Scaling Groups | Stateful or legacy apps; predictable baseline + burst capacity |
| Spot / Preemptible | Fault-tolerant batch, CI runners, ML training (50–70% cost reduction) |
| GPU / HPC clusters | ML inference, scientific computing, rendering |

## Cost optimization

- **Right-sizing** — use cloud provider recommendations (AWS Compute Optimizer, Azure Advisor) before purchasing reserved capacity; typical savings 20–30%.
- **Reserved / committed capacity** — 1-year or 3-year commitments for stable baseline workloads (30–40% discount vs on-demand).
- **Spot / preemptible** — for interruptible workloads; implement graceful shutdown handlers and checkpointing.
- **Storage lifecycle policies** — S3 Intelligent-Tiering / Azure Lifecycle Management; archive cold data after 90 days.
- **Network egress** — the hidden cost driver; co-locate services in the same region/AZ where possible; use CDN to offload origin traffic.
- **FinOps practices** — weekly cost review against budget; anomaly alerts for >20% week-over-week increase; showback reports per team.

## Security architecture

- **Zero-trust** — verify identity, device, and context for every request; no implicit trust from network location.
- **IAM** — least-privilege roles; no long-lived access keys in code or CI secrets; use instance metadata / managed identities.
- **Encryption** — TLS 1.2+ for data in transit; AES-256 for data at rest; customer-managed keys (CMK) for regulated data.
- **Network segmentation** — NACLs / NSGs per tier; WAF in front of all public-facing endpoints.
- **Compliance automation** — AWS Config / Azure Policy rules enforced at account level; failed rules block or alert.
- **Threat modeling** — apply STRIDE at design time; log all privileged operations to immutable audit store.

## Disaster recovery

- **Define RTO and RPO** — obtain from business stakeholders before designing; they determine the cost envelope.
- **Multi-region strategies** — active-passive (lower cost, higher RTO), active-active (higher cost, near-zero RTO).
- **Data replication** — synchronous for RPO = 0 (adds latency); asynchronous for RPO minutes (cross-region).
- **Failover automation** — Route 53 / Traffic Manager health checks with automated DNS failover; test quarterly.
- **Runbook creation** — documented, version-controlled, rehearsed at least annually; include rollback trigger criteria.
- **Backup architecture** — daily snapshots with cross-region copy; immutable backup retention for compliance.

## Migration strategy (6Rs)

| R | Meaning | When to use |
|---|---|---|
| Rehost | Lift-and-shift to IaaS | Fast migration; optimize later |
| Replatform | Move to managed service (RDS, App Service) | Quick wins with minimal code change |
| Repurchase | Replace with SaaS | Legacy apps with good SaaS alternatives |
| Refactor | Re-architect for cloud-native | High ROI; significant code change |
| Retain | Keep on-premises | Compliance, latency, or cost constraints |
| Retire | Decommission | Redundant or unused workloads |

## Cross-references

- General architecture principles → `skills/domain/architecture-advisory/`
- Database provisioning (managed RDS, VPC peering, connection pooling, backup) → `skills/domain/backend/database-architecture/`
- IaC patterns (Terraform, Bicep, Helm) → `skills/domain/infra/devops-engineering/references/iac.md`
- Security audit (RBAC, secrets, STRIDE) → `skills/domain/security-advisory/`

## Done / Acceptance

A cloud architecture design is ready when:
- Account / subscription structure and network topology are documented (diagram or ADR)
- IAM roles follow least-privilege; no hardcoded credentials
- All environments have budget alerts and mandatory resource tags
- Security baselines (logging, threat detection, policy enforcement) are enabled
- RTO/RPO are defined and DR strategy is documented and tested
- IaC covers all provisioned resources; no manual console changes in production
- Cost optimization opportunities (right-sizing, reserved capacity) are identified and actioned
