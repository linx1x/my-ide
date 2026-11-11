# Dashboard global CSS

[`index.css`](../index.css) imports these files **in this order** (cascade-sensitive — do not reorder without checking overrides).

| File | Role |
|------|------|
| `fonts.css` | Google Fonts `@import` |
| `tokens.css` | Reset, `:root` design tokens |
| `theme-*.css` | `body[data-theme="…"]` and theme-specific UI |
| `base.css` | Global `body` |
| `components.css` | Layout, panels, chat, builder, etc. |

Theme-specific glass UI that depends on settings markup lives in `theme-glass-ui.css` (after living-canvas). Claude token overrides load last in `theme-claude.css`.
