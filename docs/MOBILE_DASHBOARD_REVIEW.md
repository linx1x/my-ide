# Mobile Dashboard Review

This review tracks mobile usability for the dashboard after the agent chat surfaces were removed.

## Feature Inventory

| Feature area | Desktop dashboard | Mobile dashboard | Primary files |
| --- | --- | --- | --- |
| Authentication | WhatsApp OTP | Same | `src/dashboard/auth.ts`, `src/dashboard/routes/auth.ts` |
| File explore/open | Full | Available with compact navigation | `ExplorerPanel.tsx`, `FileTree.tsx`, `EditorArea.tsx` |
| Code editing | Monaco editor | Available, ergonomics-sensitive | `CodeEditor.tsx` |
| Preview | iframe preview | Full iframe preview with mobile chrome constraints | `EditorArea.tsx`, `src/dashboard/sandbox/` |
| Terminal | xterm | Available as overlay | `Terminal.tsx` |
| Secondary panels | Activity bar and More panel | Bottom navigation and More panel | `ActivityBar.tsx`, `IDELayout.tsx`, `MorePanel.tsx`, `Sidebar.tsx` |

## Mobile Priorities

1. Keep bottom-nav and More-panel access aligned with desktop.
2. Preserve safe-area handling for fixed top and bottom chrome.
3. Keep editor defaults readable on small screens.
4. Avoid heavyweight animated backgrounds on mobile by default.
5. Keep terminal and preview panels reachable without layout traps.

## Acceptance Notes

- OTP and dashboard auth remain the critical mobile entry path.
- Explorer, search, git, terminal, settings, docs, previews, and More should remain reachable without chat.
- Dashboard builds should be run after mobile layout changes with `npm run build:dashboard`.
