/**
 * BedrockJudge: validation-tier judge using AWS Bedrock Runtime.
 * Uses @aws-sdk/client-bedrock-runtime for SigV4-authenticated calls.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * Auth: AWS env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, optional AWS_SESSION_TOKEN).
 * Region: BEDROCK_REGION env or spec config, default us-east-1.
 *
 * Body/response shape per model family:
 *   anthropic.claude-* → {anthropic_version, max_tokens, messages}  → content[0].text
 *   meta.llama*        → {prompt, max_gen_len}                       → generation
 *   mistral.*          → {prompt, max_tokens}                        → outputs[0].text
 *   amazon.nova-*      → {messages, inferenceConfig}                 → output.message.content[0].text
 *
 * SLICE-90 (FEAT-169 SLICE-B3).
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";

const DEFAULT_REGION = "us-east-1";
const DEFAULT_MODEL = "anthropic.claude-3-5-sonnet-20241022-v2:0";
const DEFAULT_MAX_TOKENS = 512;

export interface BedrockConfig {
  model?: string;
  region?: string;
  maxTokens?: number;
}

const JUDGE_SYSTEM =
  "You are an expert evaluator. Given a rubric and candidate output, decide if the candidate " +
  "PASSES. Reply with JSON: {\"pass\": true|false, \"score\": 0.0..1.0, \"rationale\": \"<one sentence>\"}";

function buildPrompt(req: JudgeRequest): string {
  return (
    `${JUDGE_SYSTEM}\n\nRubric: ${req.rubric}\n\nCandidate output:\n${req.candidateOutput}` +
    (req.context?.fixture ? `\n\nFixture: ${req.context.fixture}` : "")
  );
}

function buildBody(model: string, prompt: string, maxTokens: number): Record<string, unknown> {
  if (model.startsWith("anthropic.claude")) {
    return { anthropic_version: "bedrock-2023-05-31", max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }] };
  }
  if (model.startsWith("meta.llama")) return { prompt, max_gen_len: maxTokens };
  if (model.startsWith("mistral.")) return { prompt, max_tokens: maxTokens };
  if (model.startsWith("amazon.nova")) {
    return { messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens } };
  }
  return { messages: [{ role: "user", content: prompt }], max_tokens: maxTokens };
}

function extractText(model: string, b: Record<string, unknown>): string {
  if (model.startsWith("anthropic.claude")) {
    const c = b["content"];
    return Array.isArray(c) ? String((c[0] as Record<string, unknown>)["text"] ?? "") : "";
  }
  if (model.startsWith("meta.llama")) return String(b["generation"] ?? "");
  if (model.startsWith("mistral.")) {
    const o = b["outputs"];
    return Array.isArray(o) ? String((o[0] as Record<string, unknown>)["text"] ?? "") : "";
  }
  if (model.startsWith("amazon.nova")) {
    const msg = ((b["output"] as Record<string, unknown>)?.["message"] as Record<string, unknown>);
    const c = msg?.["content"];
    return Array.isArray(c) ? String((c[0] as Record<string, unknown>)["text"] ?? "") : "";
  }
  return String(b["generation"] ?? b["text"] ?? "");
}

function parseJudgeText(text: string, raw: unknown): Pick<JudgeResult, "pass" | "score" | "rationale" | "raw"> {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const p = JSON.parse(m[0]) as { pass?: boolean; score?: number; rationale?: string };
      return { pass: p.pass ?? false, score: p.score ?? (p.pass ? 1 : 0), rationale: p.rationale ?? "", raw };
    } catch { /* fall through */ }
  }
  const pass = /^yes/i.test(text.trim());
  const br = text.indexOf("\n");
  return { pass, score: pass ? 1 : 0, rationale: br !== -1 ? text.slice(br + 1).trim() : text.trim(), raw };
}

export class BedrockJudge implements JudgeProvider {
  readonly id: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly client: BedrockRuntimeClient;

  constructor(config?: BedrockConfig) {
    this.model = config?.model ?? process.env["BEDROCK_MODEL"] ?? DEFAULT_MODEL;
    this.maxTokens = config?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const region = config?.region ?? process.env["BEDROCK_REGION"] ?? DEFAULT_REGION;
    this.id = `bedrock:${this.model}`;
    this.client = new BedrockRuntimeClient({ region });
  }

  async judge(req: JudgeRequest): Promise<JudgeResult> {
    if (!process.env["AWS_ACCESS_KEY_ID"] && !process.env["AWS_PROFILE"]) {
      throw new Error(
        "BedrockJudge: AWS credentials required. Set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY or AWS_PROFILE."
      );
    }
    const body = buildBody(this.model, buildPrompt(req), this.maxTokens);
    const cmd = new InvokeModelCommand({
      modelId: this.model, contentType: "application/json", accept: "application/json",
      body: JSON.stringify(body)
    });
    const res = await this.client.send(cmd);
    const parsed = JSON.parse(new TextDecoder().decode(res.body)) as Record<string, unknown>;
    return { ...parseJudgeText(extractText(this.model, parsed), parsed),
      providerCost: { tokensIn: 0, tokensOut: 0 } };
  }
}
