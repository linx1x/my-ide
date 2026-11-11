import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { BudgetLedgerRow, CacheRecordRow, TraceEventRow } from '../runtime/langfuse-shape.js';

export function insertTraceEvent(db: Database.Database, row: Omit<TraceEventRow, 'id' | 'createdAtMs'> & { id?: string }): void {
  const id = row.id ?? randomUUID();
  const createdAtMs = Date.now();
  db.prepare(
    `INSERT INTO trace_events (
      id, trace_id, span_id, parent_span_id, request_id, user_id, name, kind,
      start_time_ms, end_time_ms, status, input_json, output_json, metadata_json, created_at_ms
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    row.traceId,
    row.spanId ?? null,
    row.parentSpanId ?? null,
    row.requestId,
    row.userId,
    row.name,
    row.kind,
    row.startTimeMs ?? null,
    row.endTimeMs ?? null,
    row.status ?? null,
    row.inputJson ?? null,
    row.outputJson ?? null,
    row.metadataJson ?? null,
    createdAtMs,
  );
}

export function insertBudgetLedger(db: Database.Database, row: Omit<BudgetLedgerRow, 'id' | 'createdAtMs'> & { id?: string }): void {
  const id = row.id ?? randomUUID();
  db.prepare(
    `INSERT INTO budget_ledger (
      id, request_id, user_id, provider, model, input_tokens, output_tokens, total_tokens,
      cost_estimate_usd, metadata_json, created_at_ms
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    row.requestId,
    row.userId,
    row.provider,
    row.model ?? null,
    row.inputTokens ?? null,
    row.outputTokens ?? null,
    row.totalTokens ?? null,
    row.costEstimateUsd ?? null,
    row.metadataJson ?? null,
    Date.now(),
  );
}

export function insertCacheRecord(db: Database.Database, row: Omit<CacheRecordRow, 'id' | 'createdAtMs'> & { id?: string }): void {
  const id = row.id ?? randomUUID();
  db.prepare(
    `INSERT INTO cache_records (
      id, request_id, user_id, provider, cache_kind, op, key_hash, metadata_json, created_at_ms
    ) VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    row.requestId,
    row.userId,
    row.provider,
    row.cacheKind,
    row.op,
    row.keyHash ?? null,
    row.metadataJson ?? null,
    Date.now(),
  );
}

export function insertEvalRun(
  db: Database.Database,
  row: {
    id?: string;
    suite: string;
    passed: boolean;
    scoresJson?: string | null;
    metadataJson?: string | null;
  },
): void {
  const id = row.id ?? randomUUID();
  db.prepare(
    'INSERT INTO eval_runs (id, suite, passed, scores_json, metadata_json, created_at_ms) VALUES (?,?,?,?,?,?)',
  ).run(id, row.suite, row.passed ? 1 : 0, row.scoresJson ?? null, row.metadataJson ?? null, Date.now());
}
