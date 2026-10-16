# Animation guide

MindsKit uses animation to confirm a user action or explain a change on screen,
not as decoration. This guide covers which tool to pick, the shared building
blocks, and the rules that keep animation fast, accessible, and compatible
with drag and drop.

The Color Converter palette builder (`src/pages/color-palette-builder.tsx`) is
the reference implementation.

## Principles

- **Short and calm.** 150–250 ms, ease-out. Movement of 2–12 px, scale between
  0.94 and 1. Only use springs for small icon "pops".
- **Animate the change, not the page.** Animate an element when it appears,
  disappears, moves, or changes state because of something the user did. Do
  not animate on every keystroke, and do not loop animations.
- **Respect reduced motion.** Every animation must have a reduced-motion path
  (see [Reduced motion](#reduced-motion)).
- **Opt in per feature.** Add animation only to the feature being worked on.
  Do not add it to shared components (`CopyButton`, `ToolStatus`,
  `CodeEditor`, layout) without an explicit decision, because that changes
  every tool.
- **Stay local.** Motion and AutoAnimate are bundled. Do not load animation
  assets or libraries from a CDN (see `public/_headers` CSP).

## Choosing a tool

| Need | Use | Why |
|---|---|---|
| Hover lift, color/background change, focus, error text fade-in, invalid-field shake | CSS (Tailwind transitions, `tw-animate-css`, `animate-shake`) | No JS and no extra bundle cost |
| Radix open/close (Popover, Select, Sheet, Collapsible) | Existing `data-[state]` + `tw-animate-css` classes in `src/components/ui/` | Already wired; keep it consistent |
| Enter/exit of list items, staggered entrance, swapping blocks, icon state swap | Motion (`m.*` + `AnimatePresence`) | Exit animations and stagger need JS |
| Simple list that adds, removes, or reorders children, with no other transforms | AutoAnimate (`useListAutoAnimate`) | One ref, no per-item code |
| Drag-to-reorder | `@dnd-kit` (built-in sortable transition) | Already animates reorder; never add a second layout animation |

When unsure, start with CSS. Use Motion only when you need an exit
animation, stagger, or coordinated variants.

## Building blocks

### `MotionProvider` — `src/components/motion/motion-provider.tsx`

Wrap each animated feature (not the whole app) in `MotionProvider`:

- `LazyMotion` + `domAnimation` keeps Motion's bundle small.
- `strict` throws if someone uses the full `motion.*` components. Always
  import `m` from `motion/react-m`.
- `MotionConfig reducedMotion="user"` turns off transform and layout
  animation when the OS asks for reduced motion (opacity still fades).

```tsx
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { MotionProvider } from "@/components/motion/motion-provider";

export function MyFeature() {
  return (
    <MotionProvider>
      <MyFeatureContent />
    </MotionProvider>
  );
}
```

### Presets — `src/lib/motion.ts`

Use the shared presets instead of inline numbers so every tool feels the same.

| Export | Use for |
|---|---|
| `motionEase`, `motionDurations` (`fast` 0.15, `base` 0.2, `slow` 0.25), `baseTransition` | Custom transitions |
| `listContainerVariants` | Parent of a list. Staggers children by 0.04 s on mount and fades out on exit |
| `listItemVariants` | List item. Fades/slides up 12 px in and shrinks out |
| `fadeVariants` | Swapping two blocks, such as an empty state and content |
| `popVariants` | Icon swaps, such as Copy → Check |

Variant names are always `hidden` → `show` → `exit`.

### `useListAutoAnimate` — `src/hooks/use-list-auto-animate.ts`

```tsx
const listRef = useListAutoAnimate<HTMLUListElement>();
return <ul ref={listRef}>{items.map((item) => <li key={item.id}>…</li>)}</ul>;
```

It uses the shared duration and already respects `prefers-reduced-motion`.
**Do not** use it on a list that is sortable with `@dnd-kit` or whose children
use Motion `layout`, because both would animate the same move.

### CSS utilities — `src/index.css` and `tw-animate-css`

- `animate-in fade-in slide-in-from-top-1 duration-200` for messages that
  appear (`ToolStatus` already uses this).
- `animate-shake` (2 px, 220 ms, once) for an invalid field. Pair it with the
  state that triggers it: `aria-invalid:animate-shake motion-reduce:animate-none`.
- `transition-colors duration-200 ease-out` for swatches or previews whose
  inline `backgroundColor` changes.
- `transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-md`
  for card hover lift.

## Patterns

### Staggered list with enter/exit

```tsx
<AnimatePresence mode="wait" initial={false}>
  {items.length === 0 ? (
    <m.div key="empty" variants={fadeVariants} initial="hidden" animate="show" exit="exit">…</m.div>
  ) : (
    <m.div key={`list-${batch}`} variants={listContainerVariants} initial="hidden" animate="show" exit="exit">
      <ul>
        <AnimatePresence>
          {items.map((item) => (
            <m.li key={item.id} variants={listItemVariants} exit="exit">…</m.li>
          ))}
        </AnimatePresence>
      </ul>
    </m.div>
  )}
</AnimatePresence>
```

- Items inherit `initial`/`animate` from the container, so do not set them on
  each item.
- To replay the stagger for a new batch (for example after **Extract**),
  change the container `key` (`batch`). The old list fades out, then the new
  one staggers in.
- Do **not** set `initial={false}` on the inner `AnimatePresence`, because it
  cancels the stagger on mount. Setting it on the outer one is fine; it only
  skips the animation on first page load.
- Use stable IDs as keys, never array indexes.

### Sortable lists (Motion + dnd-kit)

Motion and dnd-kit both write `transform`, so give each its own element:

```tsx
<m.li variants={listItemVariants} exit="exit">        {/* Motion: enter/exit */}
  <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
                                                       {/* dnd-kit: drag + reorder */}
    <div className="transition-[translate,box-shadow] hover:-translate-y-1 …">
                                                       {/* CSS: hover lift */}
      …
    </div>
  </div>
</m.li>
```

- Do not use Motion `layout` or AutoAnimate on sortable items. dnd-kit already
  animates reordering.
- To slide the remaining items into place after a removal, pass
  `animateLayoutChanges: (args) => defaultAnimateLayoutChanges({ ...args, wasDragging: true })`
  to `useSortable`.
- Turn hover lift off while dragging (`isDragging && "hover:translate-y-0"`).
- Put inline `transition` styles (from dnd-kit) and Tailwind `transition-*`
  classes on different elements; an inline `transition` replaces the class.

### Icon state swap (Copy → Check)

```tsx
<AnimatePresence mode="wait" initial={false}>
  <m.span key={copied ? "check" : "copy"} variants={popVariants} initial="hidden" animate="show" exit="exit" className="inline-flex">
    {copied ? <Check className="text-success" /> : <Copy />}
  </m.span>
</AnimatePresence>
```

## Reduced motion

- Motion: covered by `MotionProvider` (`reducedMotion="user"`).
- AutoAnimate: covered by default (do not pass
  `disrespectUserMotionPreference`).
- CSS: add `motion-reduce:transition-none`, `motion-reduce:animate-none`, or
  `motion-reduce:hover:translate-y-0` next to each transition or animation
  class.

## Performance

- Animate `opacity`, `transform`/`translate`, `scale`, and colors. Avoid
  animating `width`, `height`, `top`, or `left`.
- Lazy-load heavy animated features (`React.lazy` in the page, as
  `value-converters-pages.tsx` does for `ColorPaletteBuilder`) so Motion and
  dnd-kit stay out of the main bundle. Give `Suspense` a fallback that keeps
  the surrounding layout stable.
- Do not animate lists that can grow very large (for example, editor output
  or generated data). Animate at most a few dozen items.
- Never animate a `CodeEditor` (CodeMirror) container's size; it measures its
  own layout.

## Checklist for a new animation

1. Is the animation tied to a user action or a state change? If not, skip it.
2. Did you use the lightest tool (CSS → AutoAnimate → Motion)?
3. Is the feature wrapped in `MotionProvider` and using `m.*` plus the presets
   from `src/lib/motion.ts`?
4. Do Motion, dnd-kit, and CSS transforms each live on their own element?
5. Does every CSS animation have a `motion-reduce:` fallback?
6. Is the animation limited to the feature, with no change to shared
   components unless that was decided?
7. Update `CONTEXT.md` if the pattern or the list of animated features
   changes.
8. Ask the user to check it in the browser: light and dark themes, mobile,
   keyboard, and with reduced motion turned on.
