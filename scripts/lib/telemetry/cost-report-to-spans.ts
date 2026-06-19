/**
 * Pure function: CostReport -> SpanRecord[].
 *
 * Produces a 3-level trace tree per FEAT-165 "Trace structure":
 *   slice.run (root) -> phase.build -> N * agent.dispatch (one per model in modelMix)
 *
 * No I/O, no Date.now(), no Math.random(). All ids are deterministic from runId.
 */
import { newTraceId, newSpanId, SpanRecordSchema, type SpanRecord } from "./span.ts";
import { type CostReport, derivedFeatureId, derivedSliceId } from "./cost-report-loader.ts";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function toNanoStr(isoDate: string): string {
  const ms = Date.parse(isoDate);
  // Use BigInt to avoid float precision loss for large nanosecond values.
  return (BigInt(ms) * 1_000_000n).toString();
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function costReportToSpans(report: CostReport): SpanRecord[] {
  const traceId = newTraceId(report.runId);
  const startNano = toNanoStr(report.windowStart);
  const endNano = toNanoStr(report.windowEnd);

  const featureId = derivedFeatureId(report);
  const sliceId = derivedSliceId(report);

  // ---------------------------------------------------------------------------
  // 1. Root slice span
  // ---------------------------------------------------------------------------
  const rootSpanId = newSpanId(report.runId + ".root");
  const rootAttrs: Record<string, string | number | boolean> = {
    run_id: report.runId,
    run_title: report.runTitle,
    started_at: report.windowStart,
    // Explicit literals so consumers can distinguish backfill-gaps from live-bug-gaps.
    branch: "unknown"
  };
  if (featureId) rootAttrs["feat_id"] = featureId;
  if (sliceId) rootAttrs["slice_id"] = sliceId;

  const rootSpan = SpanRecordSchema.parse({
    traceId,
    spanId: rootSpanId,
    name: "slice.run",
    kind: "INTERNAL",
    startTimeUnixNano: startNano,
    endTimeUnixNano: endNano,
    attributes: rootAttrs,
    events: [],
    status: { code: "OK" }
  });

  // ---------------------------------------------------------------------------
  // 2. Phase build span
  // ---------------------------------------------------------------------------
  const buildSpanId = newSpanId(report.runId + ".phase.build");
  const buildSpan = SpanRecordSchema.parse({
    traceId,
    spanId: buildSpanId,
    parentSpanId: rootSpanId,
    name: "phase.build",
    kind: "INTERNAL",
    startTimeUnixNano: startNano,
    endTimeUnixNano: endNano,
    attributes: {
      gate: "build",
      // Cost report existing implies the slice completed.
      outcome: "completed"
    },
    events: [],
    status: { code: "OK" }
  });

  // ---------------------------------------------------------------------------
  // 3. Agent dispatch spans — one per model in modelMix
  // ---------------------------------------------------------------------------
  const agentSpans: SpanRecord[] = report.modelMix.map((entry) => {
    const agentSpanId = newSpanId(report.runId + ".agent." + entry.model);
    // cache_creation_tokens collapses 5m + 1h since OTel attr does not distinguish.
    const cacheCreationTokens = report.cacheCreate1h;

    return SpanRecordSchema.parse({
      traceId,
      spanId: agentSpanId,
      parentSpanId: buildSpanId,
      name: "agent.dispatch",
      kind: "INTERNAL",
      startTimeUnixNano: startNano,
      endTimeUnixNano: endNano,
      attributes: {
        // Explicit literals: SLICE-B fills these from live hook data.
        agent: "unknown",
        model: entry.model,
        "usage.input_tokens": report.inputTokens,
        "usage.output_tokens": report.outputTokens,
        "usage.cache_read_tokens": report.cacheRead,
        "usage.cache_creation_tokens": cacheCreationTokens,
        "cost.usd": entry.usd
      },
      events: [],
      status: { code: "OK" }
    });
  });

  return [rootSpan, buildSpan, ...agentSpans];
}
