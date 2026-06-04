# Infrastructure as Code Reference

Patterns for Terraform, Helm, Ansible, and Bicep — provisioning, state management, variable isolation, and multi-environment discipline.

> For operational incident patterns (provisioner timing traps, multi-env state drift, TLS/ACME failures) see `skills/domain/terraform-ops-traps/` which covers those precisely.

## Terraform — module and state patterns

### Standard project layout

```
terraform/
  main.tf          # root module: calls child modules
  variables.tf     # input variable declarations
  outputs.tf       # output declarations
  backend.tf       # remote state backend config
  locals.tf        # computed locals + common_tags
  modules/
    vpc/
    eks/
    rds/
```

### Backend (remote state)

```hcl
terraform {
  required_version = ">= 1.0"
  backend "s3" {
    bucket = "myapp-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "us-west-2"
    encrypt = true
  }
}
```

Lock state: always enable state locking (S3 + DynamoDB, AzureRM blob leasing, GCS object locking). Never share state files between teams via direct copy.

### Common_tags pattern

```hcl
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
# Apply to every resource: tags = merge(local.common_tags, { Name = "..." })
```

### VPC + EKS module composition (AWS)

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  name    = "${var.project_name}-vpc"
  cidr    = var.vpc_cidr
  azs     = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs
  enable_nat_gateway   = true
  enable_dns_hostnames = true
  tags = local.common_tags
}

module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  cluster_name    = "${var.project_name}-cluster"
  cluster_version = var.kubernetes_version
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true
  eks_managed_node_groups = {
    main = {
      desired_size   = var.node_desired_size
      max_size       = var.node_max_size
      min_size       = var.node_min_size
      instance_types = var.node_instance_types
      update_config  = { max_unavailable_percentage = 25 }
    }
  }
  tags = local.common_tags
}
```

### RDS (production-safe)

Key flags for production RDS:
```hcl
resource "aws_db_instance" "main" {
  storage_encrypted        = true
  backup_retention_period  = var.backup_retention_period
  skip_final_snapshot      = var.environment != "production"
  deletion_protection      = var.environment == "production"
  storage_type             = "gp3"
  # ...
}
```

### ElastiCache Redis (encryption required)

```hcl
resource "aws_elasticache_replication_group" "main" {
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  # ...
}
```

## Variable isolation across environments

Never use a single `terraform.tfvars` for all environments. Use per-environment var files:

```
envs/
  staging.tfvars
  production.tfvars
```

Apply: `terraform apply -var-file=envs/staging.tfvars`

Sensitive variables: use `sensitive = true` on variable declarations. Pull actual values from Vault or SSM at apply time via `data "aws_ssm_parameter"` / `vault_generic_secret`.

## Helm chart patterns

### Deployment template checklist

- `checksum/config` + `checksum/secret` annotations on pod template — forces rollout when ConfigMap or Secret changes
- Liveness and readiness probes wired to `/health` and `/ready` endpoints with appropriate `initialDelaySeconds`
- Security context set (`runAsNonRoot: true`, `readOnlyRootFilesystem: true` where feasible)
- Resources (`requests` + `limits`) always specified — prevents noisy-neighbor OOM
- `emptyDir` volumes for `/tmp` and `/app/logs` — never write to container root FS

```yaml
# Minimal secure pod spec
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 2000
containers:
  - securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities: { drop: [ALL] }
    resources:
      requests: { cpu: 100m, memory: 128Mi }
      limits:   { cpu: 500m, memory: 512Mi }
```

### HPA (Horizontal Pod Autoscaler)

```yaml
autoscaling/v2 HPA:
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
    - type: Resource
      resource: { name: memory, target: { type: Utilization, averageUtilization: 80 } }
```

### Helm upgrade best practices

```bash
helm upgrade --install myapp ./chart \
  --namespace $NAMESPACE \
  --set image.tag=$IMAGE_TAG \
  --set environment=$ENV \
  --wait --timeout=300s \
  --atomic          # auto-rollback on failure
```

`--atomic` combines `--wait` + automatic rollback — prefer this for CI/CD pipelines.

## Ansible patterns

- Use roles for reusable automation; avoid monolithic playbooks.
- All secrets via `ansible-vault encrypt_string` or HashiCorp Vault lookup plugin.
- Idempotency: every task must be re-runnable without side effects (use `creates:`, `changed_when:`, module state checks).
- Test with `molecule` before merging role changes.

## Anti-patterns

- **Manual `terraform state mv` without backup** — always `terraform state pull > backup.tfstate` before any state surgery.
- **`count = 1` for singleton resources** — use `count` only for true arrays; use `for_each` for named resources to avoid index drift.
- **Hardcoded region or account IDs** — use `data "aws_region" "current"` and `data "aws_caller_identity" "current"`.
- **No `prevent_destroy` on critical resources** — add `lifecycle { prevent_destroy = true }` to RDS, S3 buckets, Elasticsearch domains in production.
- **Inline user_data scripts** — extract to `templatefile()`; inline scripts are untestable and hard to review.

## Done / Acceptance (IaC)

- `terraform validate` exits 0
- `terraform plan` reviewed; no unexpected deletions or replacements
- `helm lint` passes; `helm template` renders without errors
- Sensitive values declared as `sensitive = true`; never echoed in plan output
- Per-env var files present; no shared `terraform.tfvars` across environments
- `prevent_destroy` on stateful production resources
