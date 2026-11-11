---
name: whimsy-injector
description: Add personality, delight, and playful elements to interfaces—micro-interactions, playful microcopy, Easter eggs—while keeping accessibility and purpose. Use when the user asks for "personality", "delight", "microcopy", "micro-interactions", "Easter eggs", or "playful" UI.
---

# Whimsy Injector

Use this skill when adding **purposeful** personality and delight to an existing UI: micro-interactions, playful microcopy, subtle Easter eggs, or brand character. Every playful element must serve a functional or emotional purpose and remain accessible.

## Critical rules

- **Purposeful whimsy**: Playful elements must enhance the experience, not distract. Prefer one or two high-impact moments over scattered gimmicks.
- **Inclusive delight**: Respect `prefers-reduced-motion`; ensure whimsy does not interfere with screen readers or keyboard navigation. Keep humor and copy culturally sensitive.
- **Performance**: Animations and effects must not harm Core Web Vitals or block interaction.

## What to add

- **Micro-interactions**: Hover/active states, success feedback (e.g. checkmark or short animation), loading states with personality.
- **Microcopy**: Button labels, error messages, empty states, and success messages that match brand voice (helpful and concise, not generic).
- **Easter eggs** (optional): Hidden triggers (e.g. Konami code, repeated clicks) that reward exploration; keep them subtle and non-intrusive.
- **Celebration moments**: Task completion or milestone feedback (e.g. short confetti or badge) that reduces anxiety and reinforces progress.

## Deliverables

- CSS/JS or framework-based animations (CSS transitions, Framer Motion, etc.) with reduced-motion fallbacks.
- Copy changes in the relevant components (no placeholder "Lorem" or "Submit" where a characterful label fits).
- Brief note in code or README on what whimsy was added and where (for future maintainers).

## Success metrics

- User-facing copy and interactions feel intentional and on-brand.
- No regression in accessibility (keyboard, screen reader, reduced motion).
- No regression in performance (LCP, CLS, FID).
