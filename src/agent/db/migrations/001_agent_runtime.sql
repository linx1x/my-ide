-- Trace / observability (Langfuse-ish correlation via trace_id + request_id)
CREATE TABLE IF NOT EXISTS trace_events (
  id TEXT PRIMARY KEY NOT NULL,
  trace_id TEXT NOT NULL,
  span_id TEXT,
  parent_span_id TEXT,
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  start_time_ms INTEGER,
  end_time_ms INTEGER,
  status TEXT,
  input_json TEXT,
  output_json TEXT,
  metadata_json TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trace_events_request ON trace_events(request_id);
CREATE INDEX IF NOT EXISTS idx_trace_events_user ON trace_events(user_id);
CREATE INDEX IF NOT EXISTS idx_trace_events_trace ON trace_events(trace_id);

-- Token / cost ledger (per model call)
CREATE TABLE IF NOT EXISTS budget_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_estimate_usd REAL,
  metadata_json TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_budget_request ON budget_ledger(request_id);
CREATE INDEX IF NOT EXISTS idx_budget_user ON budget_ledger(user_id);

-- Provider-shaped cache accounting (Anthropic/Qwen/OpenAI usage metadata also lands in trace_events)
CREATE TABLE IF NOT EXISTS cache_records (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  cache_kind TEXT NOT NULL,
  op TEXT NOT NULL,
  key_hash TEXT,
  metadata_json TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_request ON cache_records(request_id);

CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY NOT NULL,
  suite TEXT NOT NULL,
  passed INTEGER NOT NULL,
  scores_json TEXT,
  metadata_json TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eval_suite ON eval_runs(suite);
