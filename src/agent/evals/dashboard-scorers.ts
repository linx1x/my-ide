import { createScorer } from '@mastra/core/evals';

/**
 * Example Mastra scorer used by dashboard chat (non-empty reply heuristic).
 * Production flows can add judges with `createScorer({ judge: { model, instructions } })`.
 */
export const replyNonEmptyScorer = createScorer({
  id: 'reply-non-empty',
  description: 'Assistant produced substantive text',
  type: 'agent',
}).generateScore(async ({ run }) => {
  const out = run.output as { text?: string } | string | undefined;
  const text = typeof out === 'string' ? out : (out?.text ?? '');
  return text.trim().length > 2 ? 1 : 0;
});
