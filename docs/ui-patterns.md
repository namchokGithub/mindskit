# UI patterns

Shared rules for tool pages, so every tool feels like part of one product. The building blocks live in
`src/components/tool/workspace.tsx`; animation rules are in `docs/animation.md`.

## Page structure

```tsx
<ToolPage>
  <ToolPageHeader title="…" description="…" />
  <WorkspaceSplit toolbar={…}>…</WorkspaceSplit>   {/* or Single / Canvas / Form */}
  <ToolStatus … />
</ToolPage>
```

- **Spacing:** sections are 16 px apart (`gap-4`). Cards use 16–20 px padding (`p-4 sm:p-5`); toolbars `px-3 py-2`; pane headers are at least 44 px tall.
- **Header (`ToolPageHeader`):** category label in small caps, a compact title (`text-lg sm:text-xl`), and a one-line description. On desktop, Remember input sits on the right of the header row.

## Workspace layouts

| Variant | Use for | Structure |
|---|---|---|
| `WorkspaceSplit` | Formatters, converters, text transforms | Toolbar + input pane \| output pane |
| `WorkspaceSingle` | Quick tools, generators | Toolbar + one body |
| `WorkspaceCanvas` | Images, Screen Simulator, anything with a large preview | Preview card + 20 rem side controls (stacked on mobile) |
| `WorkspaceForm` | Calculators (color, timestamp, Minecraft, password) | Centered card, max 42 rem |

Use `WorkspacePane` for each labelled pane; `tone="output"` marks a result pane.

## Buttons

One clear primary action per toolbar:

1. **Primary** (`default`): the main action (Format, Convert, Generate). Only one per toolbar, placed first.
2. **Secondary** (`outline`): supporting actions and toggles (Sample, Wrap, Import, Copy).
3. **Tertiary** (`ghost`): low-emphasis or resetting actions (Clear, Remove, Reset).
4. **Destructive** (`destructive`): only for irreversible deletes.

Toolbars use `size="sm"`. Toggles show their state with `aria-pressed` and the accent background.

## Empty states

Use `EmptyState` (icon, short title, one-line hint, optional action such as Choose file or Sample) instead of
ad-hoc dashed boxes. Editors keep their own placeholder text ("Result will appear here.").

## Results

- Results appear in an output pane (`WorkspacePane tone="output"`) with its actions (copy, view mode) in the pane header.
- Rendered previews (not editors) are wrapped in `ResultReveal`, which fades and slides in by 4 px when a new result appears.
- Status and warnings go below the workspace with `ToolStatus` and warning notes, never inside the result text.

## Cards and focus

- Workspace cards use `workspaceCardClass`: border, card background, soft shadow, and a stronger border and shadow while a control inside has focus.
- Clickable cards (Home tool cards) lift by 2 px with a stronger border and shadow on hover and show a focus ring on keyboard focus.

## Motion

CSS only (`tw-animate-css`), 150–300 ms, and always with a `motion-reduce:` fallback:

- `ToolPage` fades in on navigation.
- Result previews use `ResultReveal`.
- Card hover lift and arrow nudge on Home.

## Background

The decorative artwork (`src/assets/bg.png`) stays bottom-aligned behind content at 70% opacity on Home and 35%
on every other page, so it never competes with editors and results.

## Migration status

Applied to `AppShell`, `ToolPageHeader`, the Home tool cards, and the shared shells `FormatterPage`,
`TextTransformPage`, and the generator layout in `code-generators-pages.tsx`. Custom pages still use their own markup
and will move to these primitives in a later pass.
