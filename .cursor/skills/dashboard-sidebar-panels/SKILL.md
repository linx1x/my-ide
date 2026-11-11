---
name: dashboard-sidebar-panels
description: Adds a new sidebar panel to the IDE (ActivityBar icon, Sidebar content, LayoutContext). Use when adding a sidebar panel, new IDE panel, ActivityBar icon, sidebar tab, or when extending the dashboard UI with a new panel.
---

# Dashboard Sidebar Panels

New panels require changes in Sidebar, a new panel component, and usually **MorePanel** (or **CommandPalette** entries). Use [useLayout()](src/dashboard/client/src/context/LayoutContext.tsx) for panel state.

The desktop **ActivityBar** is fixed to five icon-only actions: chat, explorer, search, git, and terminal (see [ActivityBar.tsx](src/dashboard/client/src/components/ActivityBar.tsx)). Do not add icons there for new panels unless the product explicitly expands that row again.

## Two options: discoverable via More / command palette vs rare

- **Standard:** Add the panel to **MorePanel** and add a matching command in [CommandPalette.tsx](src/dashboard/client/src/components/CommandPalette.tsx) so users can open it from the palette. Examples: settings, skills, mcp, database, docs, scheduler, workflow, n8n workflows, more.
- **Legacy “top-level” in docs:** Only chat, explorer, search, and git are top-strip icons; everything else is More + palette (or deep links from other UI).

## 1. Panel reachable from More + command palette (typical)

### MorePanel ([src/dashboard/client/src/components/MorePanel.tsx](src/dashboard/client/src/components/MorePanel.tsx))

- Add an entry to `ITEMS`: `{ id: "myPanel", label: "My Panel", icon: "myPanel" }`.
- Add an icon to the `icons` object in MorePanel (18×18).

### CommandPalette ([src/dashboard/client/src/components/CommandPalette.tsx](src/dashboard/client/src/components/CommandPalette.tsx))

- Add `{ id: 'myPanel', label: 'Open My Panel', run: () => { onClose(); setActivePanel('myPanel'); } }` to the `commands` array.

### Sidebar ([src/dashboard/client/src/components/Sidebar.tsx](src/dashboard/client/src/components/Sidebar.tsx))

- Import the new panel component.
- Add a div:
  ```jsx
  <div className={`sidebar-panel ${activePanel === "myPanel" ? "active" : ""}`}>
    <MyPanel />
  </div>
  ```
- Only the panel with `activePanel === "myPanel"` has class `active`; CSS shows/hides via `.sidebar-panel` / `.sidebar-panel.active`.

### New component

- Create `src/dashboard/client/src/components/MyPanel.tsx`.
- Use `useLayout()` to read `activePanel`, `setActivePanel`, `sidebarVisible` as needed.
- Use `api()` from [src/dashboard/client/src/api.ts](src/dashboard/client/src/api.ts) for all fetch; never raw `fetch()`.
- Style with CSS variables from [src/dashboard/client/src/styles/tokens.css](src/dashboard/client/src/styles/tokens.css) (`:root`, imported via `index.css`): `var(--bg)`, `var(--accent)`, `var(--border)`, etc. No hardcoded colors.

## LayoutContext

- `activePanel` — current sidebar panel id (e.g. `"explorer"`, `"mcp"`).
- `setActivePanel(id)` — switch to that panel (and show sidebar if needed).
- `sidebarVisible` — whether the sidebar is open (desktop) or overlay (mobile).
- Other state: `sidebarWidth`, `terminalOpen`, `projectBuilderOpen`, etc. See [LayoutContext.tsx](src/dashboard/client/src/context/LayoutContext.tsx).

## Styling

- Panel container: use existing classes like `sidebar-header`, `sidebar-body` where appropriate.
- Colors: always `var(--bg)`, `var(--accent)`, `var(--border)`, `var(--text)`, etc. from `styles/tokens.css` `:root`.
- Run `npm run build:dashboard` from project root after changing CSS.

## Example: minimal panel component

```tsx
import { useLayout } from "../context/LayoutContext";
import { api } from "../api";

export function MyPanel() {
  const { activePanel } = useLayout();

  const load = async () => {
    const r = await api("/api/my-data");
    if (!r.ok) return;
    const data = await r.json();
    // ...
  };

  return (
    <div className="sidebar-body" style={{ padding: 8 }}>
      <h3 style={{ margin: "0 0 8px 0", color: "var(--text)" }}>My Panel</h3>
      {/* content */}
    </div>
  );
}
```

## Checklist

- [ ] MorePanel: ITEMS + icon; CommandPalette: command that calls `setActivePanel(...)`.
- [ ] Sidebar: new `sidebar-panel` div and panel component import.
- [ ] New component: uses `useLayout()`, `api()`, CSS variables.
- [ ] No raw `fetch()`; no hardcoded theme colors.
