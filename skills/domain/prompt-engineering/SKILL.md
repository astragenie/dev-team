---
name: prompt-engineering
prompt_id: prompt-engineering
version: 1.0.0
tier: domain
description: World-class prompt engineering skill for LLM optimization, prompt patterns, structured outputs, and AI product development. Expertise in Claude, GPT-4, prompt design patterns, few-shot learning, chain-of-thought, and AI evaluation. Includes RAG optimization, agent design, and LLM system architecture. Use when building AI products, optimizing LLM performance, designing agentic systems, or implementing advanced prompting techniques.
source: aitmpl/development/senior-prompt-engineer
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: agent prompt, skill description, LLM prompt, few-shot, chain-of-thought, system prompt, RAG
---

# Prompt Engineering

## When to use

- Editing or authoring an agent prompt or SKILL.md description
- Tuning an LLM prompt for better accuracy, format, or cost
- Designing few-shot examples or chain-of-thought scaffolding
- Evaluating or benchmarking prompt variants
- Building an agentic system with tool use or RAG

World-class prompt engineering skill for production-grade AI/ML/Data systems.

## Quick Start

```bash
# Prompt optimization
python scripts/prompt_optimizer.py --input data/ --output results/

# RAG evaluation
python scripts/rag_evaluator.py --target project/ --analyze

# Agent orchestration
python scripts/agent_orchestrator.py --config config.yaml --deploy
```

## Core Expertise

- Advanced production patterns and architectures
- Scalable system design and implementation
- Performance optimization at scale
- MLOps and DataOps best practices
- Real-time processing and inference
- Distributed computing frameworks
- Model deployment and monitoring
- Security and compliance
- Cost optimization
- Team leadership and mentoring

## Tech Stack

**Languages:** Python, SQL, R, Scala, Go
**ML Frameworks:** PyTorch, TensorFlow, Scikit-learn, XGBoost
**Data Tools:** Spark, Airflow, dbt, Kafka, Databricks
**LLM Frameworks:** LangChain, LlamaIndex, DSPy
**Deployment:** Docker, Kubernetes, AWS/GCP/Azure
**Monitoring:** MLflow, Weights & Biases, Prometheus
**Databases:** PostgreSQL, BigQuery, Snowflake, Pinecone

## Reference Documentation

- **Prompt Engineering Patterns** — `references/prompt_engineering_patterns.md`: advanced patterns, production strategies, performance optimization, scalability considerations.
- **LLM Evaluation Frameworks** — `references/llm_evaluation_frameworks.md`: step-by-step processes, architecture design patterns, tool integration guides.
- **Agentic System Design** — `references/agentic_system_design.md`: system design principles, implementation examples, deployment strategies.
- **Senior-Level Responsibilities** — `references/examples.md`: technical leadership, strategic thinking, collaboration patterns, and production excellence guidance.

## Production Patterns

### Pattern 1: Scalable Data Processing

Enterprise-scale data processing with distributed computing: horizontal scaling, fault-tolerant design, real-time and batch processing, data quality validation, performance monitoring.

### Pattern 2: ML Model Deployment

Production ML system with high availability: model serving with low latency, A/B testing infrastructure, feature store integration, model monitoring and drift detection, automated retraining pipelines.

### Pattern 3: Real-Time Inference

High-throughput inference system: batching and caching strategies, load balancing, auto-scaling, latency optimization, cost optimization.

## Best Practices

### Development
- Test-driven development
- Code reviews and pair programming
- Documentation as code
- Version control everything
- Continuous integration

### Production
- Monitor everything critical
- Automate deployments
- Feature flags for releases
- Canary deployments
- Comprehensive logging

## Performance Targets

**Latency:** P50 < 50ms, P95 < 100ms, P99 < 200ms
**Throughput:** > 1000 requests/second, > 10,000 concurrent users
**Availability:** 99.9% uptime, < 0.1% error rate

## Security & Compliance

- Authentication & authorization
- Data encryption (at rest & in transit)
- PII handling and anonymization
- GDPR/CCPA compliance
- Regular security audits
- Vulnerability management

## Common Commands

```bash
# Development
python -m pytest tests/ -v --cov
python -m black src/
python -m pylint src/

# Training
python scripts/train.py --config prod.yaml
python scripts/evaluate.py --model best.pth

# Deployment
docker build -t service:v1 .
kubectl apply -f k8s/
helm upgrade service ./charts/

# Monitoring
kubectl logs -f deployment/service
python scripts/health_check.py
```

## Resources

- Advanced Patterns: `references/prompt_engineering_patterns.md`
- Implementation Guide: `references/llm_evaluation_frameworks.md`
- Technical Reference: `references/agentic_system_design.md`
- Senior Responsibilities: `references/examples.md`
- Automation Scripts: `scripts/` directory

## Done / Acceptance

- Prompt change is tested against representative inputs and outputs are reviewed
- Latency and token cost impact are measured or explicitly noted
- System prompt and few-shot examples are versioned and documented
- Evaluation assertions are captured for regression tracking
