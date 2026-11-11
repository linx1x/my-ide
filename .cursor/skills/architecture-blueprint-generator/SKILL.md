---
name: architecture-blueprint-generator
description: Generate or update a comprehensive Project_Architecture_Blueprint.md by analyzing the codebase. Use when documenting architecture, onboarding, or establishing a single source of truth for structure, layers, and patterns.
---

# Architecture Blueprint Generator

Produce a single authoritative architecture document that describes this codebase: stack, layers, components, data flow, and where to add new features.

## When to Use

- First-time documentation of project architecture
- After large refactors or new subsystems
- Onboarding: one doc that explains the whole system
- Establishing where new routes, panels, or service behavior belong

## Output

Create or update **docs/Project_Architecture_Blueprint.md** (or repo root) with:

1. **Detection:** Technology stack and architectural pattern(s) in use
2. **Overview:** High-level component/layer diagram; dependency flow
3. **Core components:** Bridge entrypoint, WhatsApp adapter, dashboard server, sandbox, client
4. **Data flow:** My IDE: WhatsApp OTP / Dashboard → API → SSE/WS/local tools
5. **Cross-cutting:** Auth, CSRF, rate limit, config
6. **Guidance:** Where to add new routes, panels, services; common pitfalls

## How to Generate

Run the blueprint generation by asking the agent to analyze the codebase and write the doc, using:

- **Project type:** Node.js
- **Architecture:** Auto-detect (or Layered / Hexagonal if evident)
- **Detail:** Detailed; include code examples and implementation patterns where helpful
- **Focus:** Actual code structure in `src/`, not theoretical patterns

Reference this skill when the user asks to "document architecture," "create architecture blueprint," or "write Project_Architecture_Blueprint.md."

## After Generation

- Add a pointer in CLAUDE.md or .cursor/memory.md: "Architecture reference: docs/Project_Architecture_Blueprint.md."
- Keep the blueprint updated when adding major subsystems or changing boundaries.
