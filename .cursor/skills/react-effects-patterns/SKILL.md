---
name: react-effects-patterns
description: When writing or reviewing React code (especially in the dashboard client), avoid unnecessary Effects and apply React's "You Might Not Need an Effect" patterns. Use when adding or refactoring useEffect, component state sync, or derived state.
alwaysApply: false
---

# React Effects Patterns

Follow [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) so components stay simple, avoid extra renders, and fewer bugs from state getting out of sync.

## When to avoid Effects

- **Transforming data for render** → Derive during render or use `useMemo`. Do not store the result in state and update it in an Effect.
- **Reacting to user events** → Use event handlers (onClick, onSubmit, etc.). Do not put event-specific logic in an Effect.
- **Updating state when props or state change** → Prefer one of:
  - **Derive the value** during render (e.g. `const selection = items.find(i => i.id === selectedId) ?? null`).
  - **Adjust state during render** using a ref to store the previous value and calling setState only when the condition changes (avoids infinite loops). See React docs: [Adjusting some state when a prop changes](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  - **Reset state with a key** — pass `key={id}` to the component that holds the state so React remounts it when `id` changes and state resets automatically. See [Resetting all state when a prop changes](https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes).
- **Notifying parent of child state** → Lift state up or update parent and child in the same event handler. Do not call parent callbacks from an Effect that depends on child state.

## When Effects are appropriate

Use Effects to **synchronize with external systems**:

- **DOM** — ResizeObserver, focus, scroll-into-view, third-party widget init (e.g. timepicker).
- **Network** — Fetch, SSE/EventSource, WebSocket. Always use cleanup (e.g. `ignore` flag, AbortController, or closing the connection) to avoid race conditions and leaks.
- **Browser APIs** — `matchMedia`, storage, visibility. Prefer `useSyncExternalStore` for subscribing to external stores when it fits.
- **Subscriptions** — Custom events (`window.addEventListener`), timers (`setInterval`/`setTimeout`). Always return a cleanup that removes the listener or clears the timer.

## Concrete rules

1. **Derived data** — If a value can be computed from existing props/state, derive it during render (or memoize with `useMemo`). Do not put it in state and sync in an Effect.
2. **Reset state when X changes** — Prefer rendering a child with `key={x}` so React resets that child’s state when `x` changes. Use an Effect only when key-based reset is not practical.
3. **When X changes, set state Y** — Prefer updating Y during render (with a ref storing the previous X) instead of in an Effect, so you avoid an extra render pass.
4. **Refs that depend on props/state** — It is safe to set `ref.current` during render when deps change; you do not need an Effect for that.
5. **Data fetching in Effects** — Keep an `ignore` (or similar) flag or AbortController in the Effect and skip state updates after cleanup to avoid race conditions.

## Reference

- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Adjusting some state when a prop changes](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
- [Resetting all state when a prop changes](https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes)
