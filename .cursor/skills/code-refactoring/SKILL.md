---
name: code-refactoring
description: Simplify and refactor code while preserving behavior. Use when simplifying complex code, removing duplication, or applying design patterns. Covers Extract Method, DRY, SOLID, and refactoring checklist.
---

# Code Refactoring

Refactor for clarity and maintainability while preserving behavior.

## When to Use

- Resolving technical debt or after bug fixes
- Before adding new features (clean up first)
- Code review: finding complex or duplicated code

## Refactoring Checklist

- [ ] Function does one thing only (SRP)
- [ ] Function name clearly describes what it does
- [ ] Function is 20 lines or fewer (guideline)
- [ ] 3 or fewer parameters
- [ ] No duplicate code (DRY)
- [ ] if nesting is 2 levels or fewer
- [ ] No magic numbers (extract as constants)
- [ ] Understandable without comments (self-documenting)

## Techniques

### 1. Extract Method

Break long functions into named steps (e.g. validate → calculate → persist). Each step becomes a small function.

### 2. Remove Duplication

Extract common logic into a single function with parameters; call it from former duplicate sites.

### 3. Replace Conditional with Polymorphism

Replace long if/else or switch on type with an interface and implementations; dispatch by type.

### 4. Introduce Parameter Object

Replace many parameters with a single object (e.g. `CreateUserParams` with `profile`, `address`, `phoneNumber`).

### 5. Apply SOLID

- **Single Responsibility:** One reason to change per class/function.
- **Thin controllers:** Delegate to services/repositories; no business logic in routes.

## Constraints (MUST)

1. **Behavior preservation:** No functional changes.
2. **Small steps:** Change one thing at a time.
3. **Test first:** Have or add tests before refactoring.

## Prohibited (MUST NOT)

1. Refactoring and adding a new feature in the same change.
2. Refactoring without tests (high regression risk).

## Best Practices

- Boy Scout Rule: leave code cleaner than you found it.
- Small commits; incremental improvement.
- After refactor: run tests, `npx tsc --noEmit`, lint.

## In This Codebase

- **server.ts:** Extract route groups into modules (e.g. `routes/chat.ts`, `routes/files.ts`); keep handlers thin.
- **agent-handler.ts:** Extract command parsing, sender wiring, and streaming vs non-streaming paths into clear functions; reduce nesting.
