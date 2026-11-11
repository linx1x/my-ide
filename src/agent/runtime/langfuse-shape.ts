/**
 * Langfuse / OpenTelemetry-friendly trace row shape stored in SQLite.
 */
export type TraceEventRow = {
  id: string;
  traceId: string;
  spanId?: string | null;
  parentSpanId?: string | null;
  requestId: string;
  userId: string;
  name: string;
  kind: string;
  startTimeMs?: number | null;
  endTimeMs?: number | null;
  status?: string | null;
  inputJson?: string | null;
  outputJson?: string | null;
  metadataJson?: string | null;
  createdAtMs: number;
};

export type BudgetLedgerRow = {
  id: string;
  requestId: string;
  userId: string;
  provider: string;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  costEstimateUsd?: number | null;
  metadataJson?: string | null;
  createdAtMs: number;
};

export type CacheRecordRow = {
  id: string;
  requestId: string;
  userId: string;
  provider: string;
  cacheKind: string;
  op: string;
  keyHash?: string | null;
  metadataJson?: string | null;
  createdAtMs: number;
};
