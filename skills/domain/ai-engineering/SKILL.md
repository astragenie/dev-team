---
name: ai-engineering
tier: domain
description: End-to-end AI system engineering — model selection, training pipelines, inference optimization, MLOps, ethical AI, and production deployment. Consult when building or shipping AI/ML systems.
source: aitmpl/data-ai/ai-engineer
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: ["*.py", "train.py", "inference.py", "model_*.py", "llm_*", "agent_*", "openai", "anthropic", "torch", "tensorflow", "transformers"]
---

# AI Engineering

Specialist guidance for production-ready AI/ML systems from architecture through deployment.

## When to use

Consult this skill when:
- Designing or implementing an AI/ML system end-to-end
- Selecting model architecture, framework, or deployment strategy
- Optimizing inference latency, throughput, or model size
- Wiring Anthropic / OpenAI SDK, LangChain, LlamaIndex, or similar into an app
- Setting up training pipelines, experiment tracking, or MLOps
- Addressing bias, explainability, governance, or compliance requirements

For prompt-authoring concerns (system prompts, few-shot, chain-of-thought), co-cite `skills/domain/prompt-engineering/`.

## Engineering Checklist

- Model accuracy targets defined and tracked
- Inference latency target set (default: <100ms p95)
- Model size budget specified
- Bias metrics instrumented and thresholds set
- Explainability method selected for user-facing predictions
- A/B testing or canary rollout configured
- Monitoring + alerting live before traffic
- Governance docs and audit trail in place

## Architecture Design

1. Define use-case, success metrics, and failure modes first
2. Choose model tier: rule-based → classical ML → fine-tuned LLM → zero-shot LLM
3. Design data pipeline: ingestion → preprocessing → feature store → training
4. Select inference pattern: batch, streaming, real-time REST, or edge
5. Plan feedback loop: human review → retraining trigger → model registry
6. Size infrastructure: GPU memory, QPS, latency budget, cost ceiling

## Framework Selection

| Task | Recommended |
|---|---|
| Research / flexibility | PyTorch + Lightning |
| Production serving | TorchServe, TensorRT, ONNX Runtime |
| LLM integration | Anthropic SDK, OpenAI SDK, LangChain, LlamaIndex |
| Experiment tracking | MLflow, Weights & Biases |
| Feature store | Feast, Tecton |
| Model registry | MLflow Registry, HuggingFace Hub |
| Mobile / edge | Core ML (iOS), TFLite, OpenVINO |

## Training Pipelines

- Preprocessing: reproducible transforms; version input datasets
- Augmentation: apply only to training split, never validation/test
- Distributed training: DDP (PyTorch) or `tf.distribute` for multi-GPU
- Experiment tracking: log hyperparams, metrics, and artifacts per run
- Checkpoint management: save best + last; test restore path in CI
- Resource optimization: mixed precision (AMP), gradient checkpointing

## Inference Optimization

- **Quantization** — INT8 / FP16 via TensorRT or `torch.quantization`; measure accuracy delta
- **Pruning** — structured pruning for FLOP reduction; unstructured for sparsity
- **Distillation** — train smaller student from larger teacher; target 10× size reduction
- **Batching** — dynamic batching at serving layer; tune `max_batch_size` vs latency SLO
- **Caching** — cache embeddings for repeated inputs; KV-cache for autoregressive models
- **Hardware** — GPU for throughput; use CUDA streams for overlap; profile with `nvprof` / `torch.profiler`

## Deployment Patterns

- REST API serving: FastAPI + `uvicorn`; async handlers for I/O overlap
- gRPC: prefer for internal ML services (typed, streaming, lower overhead)
- Batch jobs: Celery / Ray for async large-batch inference
- Edge: quantize + compile to Core ML / TFLite; validate on-device latency
- Serverless: suitable for low-traffic inference; cold-start must be <2s
- Canary + shadow mode: route 5% traffic to new model; compare metrics before full cut-over

## MLOps Integration

- CI/CD: unit-test data transforms; integration-test model load + single forward pass
- Model registry: version every trained artifact; tag with dataset hash + training config
- Feature store: decouple feature computation from serving; avoid training-serving skew
- Monitoring: track data drift (input distribution), concept drift (label distribution), and prediction distribution
- Rollback: keep previous model version hot; automated rollback on metric degradation
- Shadow mode testing: run new model in parallel; log outputs; compare before promoting

## Ethical AI and Governance

- **Bias detection**: measure demographic parity, equalized odds per protected class
- **Fairness metrics**: define before training; test on held-out sub-groups
- **Explainability**: SHAP or LIME for tabular; attention maps for transformers; mandatory for credit/healthcare
- **Privacy**: differential privacy for sensitive training data; anonymize PII before ingestion
- **Robustness testing**: adversarial examples, distribution shift, out-of-distribution samples
- **Governance**: model card per release; audit trail for training data and hyperparams; access-controlled registry
- **Incident response**: rollback procedure documented; on-call runbook for model degradation

## LLM-Specific Patterns

- Prompt versioning: treat prompts as code; review and test before deployment
- Context management: chunk long documents; use RAG for factual grounding
- Tool / function calling: validate tool outputs before feeding back; handle tool errors gracefully
- Rate limiting + cost budgets: enforce per-user and per-session token caps
- Evaluation: automated evals (RAGAS, custom rubrics) + human eval for quality gates
- Streaming responses: use SSE / WebSocket; handle partial outputs gracefully

## Production Readiness

- Stress test at 2× expected peak QPS before launch
- Document failure modes: model not loaded, GPU OOM, upstream feature store down
- Recovery procedures: health check endpoint; automated restart on crash
- Monitoring: latency p50/p95/p99, error rate, model-specific metrics (confidence, rejection rate)
- Alert thresholds: page on >1% error rate or >200ms p95 latency degradation

## Done / Acceptance

AI system change is production-ready when:
- Accuracy and latency targets met on held-out test set
- Bias metrics within threshold on protected sub-groups
- Model artifact versioned and registered in registry
- Monitoring + alerts live (latency, error rate, data drift)
- Canary or shadow test passed before full traffic cut-over
- Governance doc (model card) updated for the release
- Rollback procedure tested end-to-end
