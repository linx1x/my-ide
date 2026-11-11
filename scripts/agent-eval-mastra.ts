/**
 * Minimal Mastra runEvals smoke script (requires provider API keys).
 * npm run eval:agent
 */
import { runEvals } from '@mastra/core/evals';
import { Agent } from '@mastra/core/agent';
import { replyNonEmptyScorer } from '../src/agent/evals/dashboard-scorers.js';
import {
  assertProviderConfigured,
  buildMastraModelForProvider,
  resolveDefaultProvider,
} from '../src/agent/mastra/model.js';
import { getAgentRuntimeDb } from '../src/agent/db/agent-runtime-db.js';
import { insertEvalRun } from '../src/agent/db/trace-recorder.js';
import { randomUUID } from 'node:crypto';

async function main(): Promise<void> {
  const provider = resolveDefaultProvider();
  try {
    assertProviderConfigured(provider);
  } catch (e) {
    console.warn('[eval:agent] Skipping —', e instanceof Error ? e.message : e);
    process.exit(0);
  }

  getAgentRuntimeDb();

  const model = buildMastraModelForProvider(provider);
  const agent = new Agent({
    id: 'eval-smoke-agent',
    name: 'Eval Smoke',
    instructions: 'Reply with one short friendly sentence. No tools.',
    model,
    maxRetries: 0,
  });

  const result = await runEvals({
    target: agent,
    scorers: [replyNonEmptyScorer],
    data: [{ input: 'Say hello in exactly one short sentence.' }],
    targetOptions: { maxSteps: 1, runId: randomUUID() },
    concurrency: 1,
  });

  insertEvalRun(getAgentRuntimeDb(), {
    suite: 'mastra-runEvals-smoke',
    passed: true,
    scoresJson: JSON.stringify(result.scores ?? {}),
    metadataJson: JSON.stringify({ provider, summary: result.summary }),
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
