# Screenshot Beautifier v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new client-side "Screenshot Beautifier" tool at `/images/screenshot-beautifier` that turns a pasted/dropped/uploaded screenshot into a polished composition (background, padding, radius, shadow, frame, scale/position, perspective) and exports it as a high-resolution PNG/JPG or copies it to the clipboard — entirely in the browser.

**Architecture:** Pure, unit-tested logic (design-state model, presets, canvas geometry, image validation, filename/export helpers) lives in flat modules under `src/features/screenshot-beautifier/`, mirroring `src/features/images/{resize,crop}.ts`. A single page component (`src/pages/screenshot-beautifier-page.tsx`), lazy-loaded like `ReadmeBuilderPage`/`ImageRemoveBackgroundPage`, composes the live preview with plain CSS (background/padding/radius/shadow/frame chrome/perspective) inside a "stage" div sized to the real export pixel dimensions, visually scaled down to fit the panel with a CSS `transform: scale()` wrapper. Export rasterizes that same untransformed stage node with `html-to-image` at up to 2x pixel density.

**Tech Stack:** React 19 + TypeScript (strict), Tailwind v4 semantic tokens, existing shadcn/Radix `Button`/`Select`/`Checkbox`, `sonner` toasts (via existing hooks), native Clipboard API, new dependency `html-to-image` for DOM-to-PNG/JPG rasterization (dynamically imported, same pattern as `sql-formatter` in `src/features/sql.ts:145`).

**Spec:** `docs/plan/screenshot_beatifier_plan.md` (v1 spec this plan implements). `docs/plan/screenshot-beatifier_v2_plan.md` describes v2 scope (custom background images, text layers, watermarks, saved presets, advanced device mockups) — explicitly out of scope here.

## Global Constraints

- Client-side only. Never upload the screenshot or send it to any API; no backend, database, auth, analytics, or third-party content-processing service (`AGENTS.md`).
- Max screenshot file size ~20 MiB, max dimensions ~10,000 × 10,000 px (same limits as `src/features/images/resize.ts`).
- Accept PNG, JPEG, and WebP input (existing image-tool convention).
- Never persist the screenshot itself (no localStorage/IndexedDB for image bytes/Object URLs). Only non-sensitive design _preferences_ (last canvas preset, last gradient preset, last frame) may persist, and only through the existing opt-in `usePersistedInput`/`mindskit:input:<key>` mechanism (off by default, driven by the shared "Remember input" checkbox).
- Revoke every `Object URL` (screenshot preview, prior export result) before replacing or on unmount — no leaks.
- Route under `/images/...` (existing convention beats the spec's suggested `/image/...`), category `images`, added to both `src/config/tools.ts` and `src/App.tsx`.
- Padding 0–200px (default 64), radius 0–48px (default ~14), scale 50–120% (default 100%), perspective rotateX/rotateY roughly −15°…+15° (default 0/0). Do not allow distortion (aspect ratio always preserved).
- Export target ~2x pixel density, capped so neither exported edge exceeds ~4096px (avoid crashing mobile browsers on huge "Auto" canvases).
- JPG export uses an opaque background and a 90% quality default; the composed canvas background (solid/gradient) is always opaque by construction, so there is no transparent-region edge case to special-case.
- The **composed export artwork** (canvas background, frame/bezel chrome colors) is intentionally independent of the MindsKit UI theme — do not theme it with semantic tokens. The **surrounding inspector UI** (labels, panels, buttons) must use semantic theme tokens as every other tool does.
- v1 only: no custom background images, pattern backgrounds, text layers, watermarks/logos, multiple screenshot layouts, saved custom presets, advanced/branded device mockups, freeform editing, layer panels, or drawing tools. No Fabric.js/Konva/scene-graph library.
- No CSP changes needed: `html-to-image` runs fully client-side and only produces `blob:`/`data:` output, already allowed by `public/_headers` `img-src`.

## Review Focus

- Clipboard paste with no image on the clipboard (e.g. copied text) must show a clear inline error via `ToolStatus`, not throw or silently do nothing — covered in Task 4 (`extractImageFileFromClipboard` returns `null`) and Task 7 (page shows the error).
- An invalid drop/paste/upload (wrong MIME type, >20 MiB, or >10,000px on a side) must be rejected without replacing the screenshot currently loaded — covered in Task 4 (`validateScreenshotFile`/`validateScreenshotDimensions`) and Task 7 (page keeps prior state on rejection).
- Canvas geometry math must never divide by zero or return `NaN`/`Infinity` (e.g. before an image has loaded, or a canvas preset smaller than the screenshot with 0 scale) — covered in Task 3 (`resolveFittedScreenshotSize`/`resolveExportPixelRatio` guard tests).
- Copying to the clipboard when the browser lacks `ClipboardItem`/`navigator.clipboard.write` must reject with a clear message and leave Download working, never fail silently — covered in Task 5 (`copyBlobToClipboard`) and Task 11 (page wiring + toast).
- Repeated/concurrent export clicks and successive screenshot replacements must not leak `Object URL`s or fire overlapping exports — covered in Task 11 (processing-state guard + revoke-before-replace).

---

## File Structure

- `src/features/screenshot-beautifier/model.ts` — `ScreenshotDesign` state shape, defaults, clamping, reset, and persisted-preference merge/serialize.
- `src/features/screenshot-beautifier/presets.ts` — gradient presets, canvas size presets, shadow CSS, frame options + chrome geometry, position alignment, perspective presets.
- `src/features/screenshot-beautifier/layout.ts` — pure canvas-size and screenshot-fit geometry, export pixel-ratio resolution.
- `src/features/screenshot-beautifier/image.ts` — file/dimension validation, clipboard-item extraction, byte formatting.
- `src/features/screenshot-beautifier/export.ts` — export filename, DOM→Blob rasterization (`html-to-image`), clipboard image copy.
- `src/pages/screenshot-beautifier-page.tsx` — the tool page (upload/paste/drop, controls, live preview stage, export/copy/reset actions).
- `tests/screenshot-beautifier.test.ts` — Node test runner coverage for the four pure modules above.
- `src/config/tools.ts`, `src/App.tsx` — registry entry + lazy route.
- `CONTEXT.md`, `README.md` — user-visible documentation updates.

---

### Task 1: Design state model

**Files:**

- Create: `src/features/screenshot-beautifier/model.ts`
- Test: `tests/screenshot-beautifier.test.ts` (new file; this task adds the first block of tests)

**Interfaces:**

- Produces: `BackgroundType`, `ShadowLevel`, `ScreenshotPosition`, `FramePreset`, `CanvasPresetId` (string literal unions), `ScreenshotBackground`, `ScreenshotDesign` (types), `DEFAULT_DESIGN: ScreenshotDesign`, `PADDING_RANGE`, `RADIUS_RANGE`, `SCALE_RANGE`, `PERSPECTIVE_RANGE` (`{ min: number; max: number }`), `clampPadding/clampRadius/clampScale/clampPerspective(value: number): number`, `normalizeDesign(design: ScreenshotDesign): ScreenshotDesign`, `resetDesign(): ScreenshotDesign`, `backgroundCss(background: ScreenshotBackground): string`, `PersistedScreenshotPrefs` (type), `serializePersistedPreferences(design: ScreenshotDesign): string`, `mergePersistedPreferences(base: ScreenshotDesign, raw: string): ScreenshotDesign`.
- Consumes: `findGradientPreset` from `presets.ts` (Task 2) inside `mergePersistedPreferences` only — implement `mergePersistedPreferences` in this task with a local, structurally-typed lookup parameter so Task 1 has no import-order dependency on Task 2 (see Step 3).

- [ ] **Step 1: Write the failing tests**

Create `tests/screenshot-beautifier.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DESIGN,
  backgroundCss,
  clampPadding,
  clampPerspective,
  clampRadius,
  clampScale,
  mergePersistedPreferences,
  normalizeDesign,
  resetDesign,
  serializePersistedPreferences,
  type ScreenshotDesign,
} from "../src/features/screenshot-beautifier/model.ts";

test("clamps design values into their supported ranges", () => {
  assert.equal(clampPadding(-10), 0);
  assert.equal(clampPadding(500), 200);
  assert.equal(clampRadius(Number.NaN), 0);
  assert.equal(clampScale(10), 50);
  assert.equal(clampScale(999), 120);
  assert.equal(clampPerspective(-40), -15);
  assert.equal(clampPerspective(40), 15);
});

test("normalizeDesign clamps every numeric field without mutating the input", () => {
  const dirty: ScreenshotDesign = {
    ...DEFAULT_DESIGN,
    padding: -5,
    radius: 999,
    scale: 1,
    perspectiveX: 99,
    perspectiveY: -99,
  };
  const normalized = normalizeDesign(dirty);
  assert.deepEqual(normalized, {
    ...DEFAULT_DESIGN,
    padding: 0,
    radius: 48,
    scale: 50,
    perspectiveX: 15,
    perspectiveY: -15,
  });
  assert.equal(dirty.padding, -5);
});

test("resetDesign returns a fresh, independent copy of the defaults", () => {
  const a = resetDesign();
  const b = resetDesign();
  assert.deepEqual(a, DEFAULT_DESIGN);
  assert.notEqual(a, DEFAULT_DESIGN);
  assert.notEqual(a.background, b.background);
});

test("backgroundCss renders a solid color or a linear-gradient string", () => {
  assert.equal(
    backgroundCss({
      type: "solid",
      color: "#112233",
      gradientFrom: "#000",
      gradientTo: "#fff",
      gradientAngle: 90,
      gradientPresetId: null,
    }),
    "#112233",
  );
  assert.equal(
    backgroundCss({
      type: "gradient",
      color: "#000",
      gradientFrom: "#7C3AED",
      gradientTo: "#3B82F6",
      gradientAngle: 135,
      gradientPresetId: null,
    }),
    "linear-gradient(135deg, #7C3AED, #3B82F6)",
  );
});

test("serializePersistedPreferences keeps only canvasPreset, gradientPresetId, and frame", () => {
  const json = serializePersistedPreferences({
    ...DEFAULT_DESIGN,
    canvasPreset: "1:1",
    frame: "browser-macos",
  });
  assert.deepEqual(JSON.parse(json), {
    canvasPreset: "1:1",
    gradientPresetId: DEFAULT_DESIGN.background.gradientPresetId,
    frame: "browser-macos",
  });
});

test("mergePersistedPreferences ignores invalid or unparsable stored preferences", () => {
  assert.deepEqual(
    mergePersistedPreferences(DEFAULT_DESIGN, ""),
    DEFAULT_DESIGN,
  );
  assert.deepEqual(
    mergePersistedPreferences(DEFAULT_DESIGN, "not json"),
    DEFAULT_DESIGN,
  );
  assert.deepEqual(
    mergePersistedPreferences(DEFAULT_DESIGN, '{"canvasPreset":123}'),
    DEFAULT_DESIGN,
  );
});

test("mergePersistedPreferences applies a known canvas preset and frame", () => {
  const merged = mergePersistedPreferences(
    DEFAULT_DESIGN,
    JSON.stringify({
      canvasPreset: "1:1",
      gradientPresetId: null,
      frame: "device-laptop",
    }),
  );
  assert.equal(merged.canvasPreset, "1:1");
  assert.equal(merged.frame, "device-laptop");
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm test:sql`
Expected: FAIL — `Cannot find module '../src/features/screenshot-beautifier/model.ts'`

- [ ] **Step 3: Implement `model.ts`**

```ts
export type BackgroundType = "solid" | "gradient";
export type ShadowLevel = "none" | "soft" | "medium" | "strong";
export type ScreenshotPosition = "center" | "top" | "bottom" | "left" | "right";
export type FramePreset =
  | "none"
  | "browser-minimal"
  | "browser-macos"
  | "device-phone-portrait"
  | "device-phone-landscape"
  | "device-laptop";
export type CanvasPresetId =
  | "auto"
  | "16:9"
  | "4:3"
  | "1:1"
  | "3:2"
  | "9:16"
  | "x-post"
  | "instagram-square"
  | "instagram-portrait";

export interface ScreenshotBackground {
  type: BackgroundType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  gradientPresetId: string | null;
}

export interface ScreenshotDesign {
  canvasPreset: CanvasPresetId;
  background: ScreenshotBackground;
  padding: number;
  radius: number;
  shadow: ShadowLevel;
  scale: number;
  position: ScreenshotPosition;
  frame: FramePreset;
  perspectiveX: number;
  perspectiveY: number;
}

export const PADDING_RANGE = { min: 0, max: 200 };
export const RADIUS_RANGE = { min: 0, max: 48 };
export const SCALE_RANGE = { min: 50, max: 120 };
export const PERSPECTIVE_RANGE = { min: -15, max: 15 };

export const DEFAULT_DESIGN: ScreenshotDesign = {
  canvasPreset: "auto",
  background: {
    type: "gradient",
    color: "#111827",
    gradientFrom: "#4C1D95",
    gradientTo: "#1E1B4B",
    gradientAngle: 135,
    gradientPresetId: "midnight-violet",
  },
  padding: 64,
  radius: 14,
  shadow: "medium",
  scale: 100,
  position: "center",
  frame: "none",
  perspectiveX: 0,
  perspectiveY: 0,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampPadding(value: number): number {
  return clamp(value, PADDING_RANGE.min, PADDING_RANGE.max);
}
export function clampRadius(value: number): number {
  return clamp(value, RADIUS_RANGE.min, RADIUS_RANGE.max);
}
export function clampScale(value: number): number {
  return clamp(value, SCALE_RANGE.min, SCALE_RANGE.max);
}
export function clampPerspective(value: number): number {
  return clamp(value, PERSPECTIVE_RANGE.min, PERSPECTIVE_RANGE.max);
}

export function normalizeDesign(design: ScreenshotDesign): ScreenshotDesign {
  return {
    ...design,
    background: { ...design.background },
    padding: clampPadding(design.padding),
    radius: clampRadius(design.radius),
    scale: clampScale(design.scale),
    perspectiveX: clampPerspective(design.perspectiveX),
    perspectiveY: clampPerspective(design.perspectiveY),
  };
}

export function resetDesign(): ScreenshotDesign {
  return { ...DEFAULT_DESIGN, background: { ...DEFAULT_DESIGN.background } };
}

export function backgroundCss(background: ScreenshotBackground): string {
  if (background.type === "solid") return background.color;
  return `linear-gradient(${background.gradientAngle}deg, ${background.gradientFrom}, ${background.gradientTo})`;
}

export interface PersistedScreenshotPrefs {
  canvasPreset: CanvasPresetId;
  gradientPresetId: string | null;
  frame: FramePreset;
}

const CANVAS_PRESET_IDS: readonly CanvasPresetId[] = [
  "auto",
  "16:9",
  "4:3",
  "1:1",
  "3:2",
  "9:16",
  "x-post",
  "instagram-square",
  "instagram-portrait",
];
const FRAME_PRESET_IDS: readonly FramePreset[] = [
  "none",
  "browser-minimal",
  "browser-macos",
  "device-phone-portrait",
  "device-phone-landscape",
  "device-laptop",
];

export function serializePersistedPreferences(
  design: ScreenshotDesign,
): string {
  const prefs: PersistedScreenshotPrefs = {
    canvasPreset: design.canvasPreset,
    gradientPresetId: design.background.gradientPresetId,
    frame: design.frame,
  };
  return JSON.stringify(prefs);
}

/** `resolveGradientPreset` looks up a gradient preset by id (see `presets.ts`); passed in so this module has no import-order dependency on `presets.ts`. */
export function mergePersistedPreferences(
  base: ScreenshotDesign,
  raw: string,
  resolveGradientPreset?: (
    id: string,
  ) => { from: string; to: string; angle: number } | undefined,
): ScreenshotDesign {
  if (!raw) return base;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (typeof parsed !== "object" || parsed === null) return base;
  const candidate = parsed as Partial<PersistedScreenshotPrefs>;

  const next = normalizeDesign(base);
  if (
    typeof candidate.canvasPreset === "string" &&
    CANVAS_PRESET_IDS.includes(candidate.canvasPreset as CanvasPresetId)
  ) {
    next.canvasPreset = candidate.canvasPreset as CanvasPresetId;
  }
  if (
    typeof candidate.frame === "string" &&
    FRAME_PRESET_IDS.includes(candidate.frame as FramePreset)
  ) {
    next.frame = candidate.frame as FramePreset;
  }
  if (typeof candidate.gradientPresetId === "string" && resolveGradientPreset) {
    const preset = resolveGradientPreset(candidate.gradientPresetId);
    if (preset) {
      next.background = {
        ...next.background,
        type: "gradient",
        gradientFrom: preset.from,
        gradientTo: preset.to,
        gradientAngle: preset.angle,
        gradientPresetId: candidate.gradientPresetId,
      };
    }
  }
  return next;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test:sql`
Expected: PASS (all `screenshot-beautifier.test.ts` cases from Step 1)

- [ ] **Step 5: Lint and commit**

Run: `pnpm lint`
Expected: no errors on the new file.

```bash
git add src/features/screenshot-beautifier/model.ts tests/screenshot-beautifier.test.ts
git commit -m "feat(screenshot-beautifier): add design state model"
```

---

### Task 2: Presets and lookups

**Files:**

- Create: `src/features/screenshot-beautifier/presets.ts`
- Modify: `tests/screenshot-beautifier.test.ts`

**Interfaces:**

- Consumes: `CanvasPresetId`, `FramePreset`, `ScreenshotPosition`, `ShadowLevel` from `model.ts` (Task 1).
- Produces: `GradientPreset` (type, `{ id: string; name: string; from: string; to: string; angle: number }`), `GRADIENT_PRESETS: GradientPreset[]`, `findGradientPreset(id: string): GradientPreset | undefined`; `CanvasSizePreset` (type, `{ id: CanvasPresetId; label: string; width: number | null; height: number | null }`), `CANVAS_SIZE_PRESETS: CanvasSizePreset[]`, `findCanvasSizePreset(id: CanvasPresetId): CanvasSizePreset`; `SHADOW_CSS: Record<ShadowLevel, string>`; `FrameChrome` (type, `{ top: number; right: number; bottom: number; left: number }`), `FRAME_CHROME: Record<FramePreset, FrameChrome>`; `FrameOption` (type, `{ id: FramePreset; label: string; group: 'none' | 'browser' | 'device' }`), `FRAME_OPTIONS: FrameOption[]`; `POSITION_OPTIONS: { id: ScreenshotPosition; label: string }[]`, `POSITION_ALIGN: Record<ScreenshotPosition, { justify: string; align: string }>`; `PerspectivePreset` (type, `{ id: string; label: string; x: number; y: number }`), `PERSPECTIVE_PRESETS: PerspectivePreset[]`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/screenshot-beautifier.test.ts`:

```ts
import {
  CANVAS_SIZE_PRESETS,
  findCanvasSizePreset,
  findGradientPreset,
  FRAME_CHROME,
  GRADIENT_PRESETS,
  SHADOW_CSS,
} from "../src/features/screenshot-beautifier/presets.ts";

test("exposes 6 named gradient presets that resolve by id", () => {
  assert.equal(GRADIENT_PRESETS.length, 6);
  assert.equal(findGradientPreset("midnight-violet")?.from, "#4C1D95");
  assert.equal(findGradientPreset("unknown-id"), undefined);
});

test("canvas size presets: auto has no fixed size, named presets do", () => {
  assert.deepEqual(findCanvasSizePreset("auto"), {
    id: "auto",
    label: "Auto",
    width: null,
    height: null,
  });
  assert.deepEqual(
    findCanvasSizePreset("1:1"),
    CANVAS_SIZE_PRESETS.find((preset) => preset.id === "1:1"),
  );
  assert.equal(findCanvasSizePreset("1:1").width, 1200);
  assert.equal(findCanvasSizePreset("instagram-portrait").height, 1350);
});

test("shadow levels map to CSS box-shadow values, with none disabling it", () => {
  assert.equal(SHADOW_CSS.none, "none");
  assert.notEqual(SHADOW_CSS.soft, "none");
  assert.notEqual(SHADOW_CSS.medium, SHADOW_CSS.strong);
});

test("frame chrome geometry has zero inset for none and browser frames only add top height", () => {
  assert.deepEqual(FRAME_CHROME.none, { top: 0, right: 0, bottom: 0, left: 0 });
  assert.equal(FRAME_CHROME["browser-minimal"].right, 0);
  assert.ok(FRAME_CHROME["browser-minimal"].top > 0);
  assert.ok(
    FRAME_CHROME["device-laptop"].bottom > FRAME_CHROME["device-laptop"].top,
  );
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm test:sql`
Expected: FAIL — `Cannot find module '../src/features/screenshot-beautifier/presets.ts'`

- [ ] **Step 3: Implement `presets.ts`**

```ts
import type {
  CanvasPresetId,
  FramePreset,
  ScreenshotPosition,
  ShadowLevel,
} from "./model.ts";

export interface GradientPreset {
  id: string;
  name: string;
  from: string;
  to: string;
  angle: number;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: "midnight-violet",
    name: "Midnight Violet",
    from: "#4C1D95",
    to: "#1E1B4B",
    angle: 135,
  },
  {
    id: "aurora-blue",
    name: "Aurora Blue",
    from: "#0EA5E9",
    to: "#6366F1",
    angle: 135,
  },
  {
    id: "cyber-rose",
    name: "Cyber Rose",
    from: "#F472B6",
    to: "#7C3AED",
    angle: 135,
  },
  {
    id: "sunset-ember",
    name: "Sunset Ember",
    from: "#F97316",
    to: "#DB2777",
    angle: 135,
  },
  {
    id: "emerald",
    name: "Emerald",
    from: "#10B981",
    to: "#047857",
    angle: 135,
  },
  {
    id: "soft-peach",
    name: "Soft Peach",
    from: "#FED7AA",
    to: "#FCA5A5",
    angle: 135,
  },
];

export function findGradientPreset(id: string): GradientPreset | undefined {
  return GRADIENT_PRESETS.find((preset) => preset.id === id);
}

export interface CanvasSizePreset {
  id: CanvasPresetId;
  label: string;
  width: number | null;
  height: number | null;
}

export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { id: "auto", label: "Auto", width: null, height: null },
  { id: "16:9", label: "16:9", width: 1600, height: 900 },
  { id: "4:3", label: "4:3", width: 1600, height: 1200 },
  { id: "1:1", label: "1:1", width: 1200, height: 1200 },
  { id: "3:2", label: "3:2", width: 1500, height: 1000 },
  { id: "9:16", label: "9:16", width: 900, height: 1600 },
  { id: "x-post", label: "X / Twitter post", width: 1200, height: 675 },
  {
    id: "instagram-square",
    label: "Instagram square",
    width: 1080,
    height: 1080,
  },
  {
    id: "instagram-portrait",
    label: "Instagram portrait",
    width: 1080,
    height: 1350,
  },
];

export function findCanvasSizePreset(id: CanvasPresetId): CanvasSizePreset {
  return (
    CANVAS_SIZE_PRESETS.find((preset) => preset.id === id) ??
    CANVAS_SIZE_PRESETS[0]
  );
}

export const SHADOW_CSS: Record<ShadowLevel, string> = {
  none: "none",
  soft: "0 10px 30px -12px rgba(0,0,0,0.25)",
  medium: "0 20px 45px -15px rgba(0,0,0,0.35)",
  strong: "0 30px 60px -12px rgba(0,0,0,0.5)",
};

export interface FrameChrome {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const FRAME_CHROME: Record<FramePreset, FrameChrome> = {
  none: { top: 0, right: 0, bottom: 0, left: 0 },
  "browser-minimal": { top: 28, right: 0, bottom: 0, left: 0 },
  "browser-macos": { top: 36, right: 0, bottom: 0, left: 0 },
  "device-phone-portrait": { top: 20, right: 10, bottom: 20, left: 10 },
  "device-phone-landscape": { top: 10, right: 20, bottom: 10, left: 20 },
  "device-laptop": { top: 14, right: 14, bottom: 34, left: 14 },
};

export interface FrameOption {
  id: FramePreset;
  label: string;
  group: "none" | "browser" | "device";
}

export const FRAME_OPTIONS: FrameOption[] = [
  { id: "none", label: "None", group: "none" },
  { id: "browser-minimal", label: "Minimal browser", group: "browser" },
  { id: "browser-macos", label: "macOS-style browser", group: "browser" },
  { id: "device-phone-portrait", label: "Phone (portrait)", group: "device" },
  { id: "device-phone-landscape", label: "Phone (landscape)", group: "device" },
  { id: "device-laptop", label: "Laptop / desktop", group: "device" },
];

export const POSITION_OPTIONS: { id: ScreenshotPosition; label: string }[] = [
  { id: "center", label: "Center" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

export const POSITION_ALIGN: Record<
  ScreenshotPosition,
  { justify: string; align: string }
> = {
  center: { justify: "center", align: "center" },
  top: { justify: "center", align: "flex-start" },
  bottom: { justify: "center", align: "flex-end" },
  left: { justify: "flex-start", align: "center" },
  right: { justify: "flex-end", align: "center" },
};

export interface PerspectivePreset {
  id: string;
  label: string;
  x: number;
  y: number;
}

export const PERSPECTIVE_PRESETS: PerspectivePreset[] = [
  { id: "none", label: "None", x: 0, y: 0 },
  { id: "tilt-left", label: "Tilt Left", x: 0, y: -10 },
  { id: "tilt-right", label: "Tilt Right", x: 0, y: 10 },
  { id: "tilt-up", label: "Tilt Up", x: 8, y: 0 },
  { id: "tilt-down", label: "Tilt Down", x: -8, y: 0 },
];
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test:sql`
Expected: PASS

- [ ] **Step 5: Lint and commit**

Run: `pnpm lint`

```bash
git add src/features/screenshot-beautifier/presets.ts tests/screenshot-beautifier.test.ts
git commit -m "feat(screenshot-beautifier): add gradient, canvas, frame, and perspective presets"
```

---

### Task 3: Canvas and screenshot-fit geometry

**Files:**

- Create: `src/features/screenshot-beautifier/layout.ts`
- Modify: `tests/screenshot-beautifier.test.ts`

**Interfaces:**

- Consumes: `ScreenshotDesign`, `FramePreset` from `model.ts` (Task 1); `findCanvasSizePreset`, `FRAME_CHROME`, `FrameChrome` from `presets.ts` (Task 2).
- Produces: `CanvasSize` (type, `{ width: number; height: number }`), `NaturalSize` (type, `{ width: number; height: number }`), `resolveCanvasSize(design: Pick<ScreenshotDesign, 'canvasPreset' | 'padding' | 'scale' | 'frame'>, screenshot: NaturalSize): CanvasSize`, `resolveFittedScreenshotSize(canvas: CanvasSize, padding: number, chrome: FrameChrome, screenshot: NaturalSize, scale: number): CanvasSize`, `resolveExportPixelRatio(canvas: CanvasSize, targetRatio?: number, maxEdge?: number): number`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/screenshot-beautifier.test.ts`:

```ts
import {
  resolveCanvasSize,
  resolveExportPixelRatio,
  resolveFittedScreenshotSize,
} from "../src/features/screenshot-beautifier/layout.ts";

test("resolveCanvasSize uses the fixed preset size regardless of the screenshot", () => {
  const size = resolveCanvasSize(
    { canvasPreset: "1:1", padding: 64, scale: 100, frame: "none" },
    { width: 3000, height: 500 },
  );
  assert.deepEqual(size, { width: 1200, height: 1200 });
});

test("resolveCanvasSize computes an Auto canvas from the scaled screenshot, padding, and frame chrome", () => {
  const size = resolveCanvasSize(
    { canvasPreset: "auto", padding: 64, scale: 50, frame: "browser-minimal" },
    { width: 2000, height: 1000 },
  );
  assert.deepEqual(size, { width: 1000 + 128, height: 500 + 28 + 128 });
});

test("resolveFittedScreenshotSize preserves aspect ratio and never overflows the available area", () => {
  const canvas = { width: 800, height: 800 };
  const fitted = resolveFittedScreenshotSize(
    canvas,
    64,
    { top: 0, right: 0, bottom: 0, left: 0 },
    { width: 2000, height: 1000 },
    100,
  );
  assert.ok(fitted.width <= canvas.width - 128);
  assert.ok(fitted.height <= canvas.height - 128);
  assert.equal(Math.round((fitted.width / fitted.height) * 100) / 100, 2);
});

test("resolveFittedScreenshotSize never returns zero or negative size for a degenerate canvas", () => {
  const fitted = resolveFittedScreenshotSize(
    { width: 10, height: 10 },
    64,
    { top: 0, right: 0, bottom: 0, left: 0 },
    { width: 2000, height: 1000 },
    100,
  );
  assert.ok(fitted.width > 0);
  assert.ok(fitted.height > 0);
});

test("resolveExportPixelRatio targets 2x but caps the longest exported edge", () => {
  assert.equal(resolveExportPixelRatio({ width: 1200, height: 675 }), 2);
  assert.equal(
    resolveExportPixelRatio({ width: 3000, height: 3000 }, 2, 4096),
    Math.min(2, 4096 / 3000),
  );
  assert.ok(
    resolveExportPixelRatio({ width: 3000, height: 3000 }, 2, 4096) >= 1,
  );
});

test("resolveExportPixelRatio never divides by zero for a degenerate canvas", () => {
  const ratio = resolveExportPixelRatio({ width: 0, height: 0 });
  assert.ok(Number.isFinite(ratio));
  assert.ok(ratio >= 1);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm test:sql`
Expected: FAIL — `Cannot find module '../src/features/screenshot-beautifier/layout.ts'`

- [ ] **Step 3: Implement `layout.ts`**

```ts
import type { FramePreset, ScreenshotDesign } from "./model.ts";
import {
  FRAME_CHROME,
  findCanvasSizePreset,
  type FrameChrome,
} from "./presets.ts";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface NaturalSize {
  width: number;
  height: number;
}

export function resolveCanvasSize(
  design: Pick<
    ScreenshotDesign,
    "canvasPreset" | "padding" | "scale" | "frame"
  >,
  screenshot: NaturalSize,
): CanvasSize {
  const preset = findCanvasSizePreset(design.canvasPreset);
  if (preset.width !== null && preset.height !== null)
    return { width: preset.width, height: preset.height };

  const chrome = FRAME_CHROME[design.frame];
  const displayWidth = (screenshot.width * design.scale) / 100;
  const displayHeight = (screenshot.height * design.scale) / 100;

  return {
    width: Math.max(
      1,
      Math.round(
        displayWidth + chrome.left + chrome.right + design.padding * 2,
      ),
    ),
    height: Math.max(
      1,
      Math.round(
        displayHeight + chrome.top + chrome.bottom + design.padding * 2,
      ),
    ),
  };
}

export function resolveFittedScreenshotSize(
  canvas: CanvasSize,
  padding: number,
  chrome: FrameChrome,
  screenshot: NaturalSize,
  scale: number,
): CanvasSize {
  const availableWidth = Math.max(
    1,
    canvas.width - padding * 2 - chrome.left - chrome.right,
  );
  const availableHeight = Math.max(
    1,
    canvas.height - padding * 2 - chrome.top - chrome.bottom,
  );
  const desiredWidth = Math.max(1, (screenshot.width * scale) / 100);
  const desiredHeight = Math.max(1, (screenshot.height * scale) / 100);
  const fitRatio = Math.min(
    1,
    availableWidth / desiredWidth,
    availableHeight / desiredHeight,
  );

  return {
    width: Math.max(1, Math.round(desiredWidth * fitRatio)),
    height: Math.max(1, Math.round(desiredHeight * fitRatio)),
  };
}

export function resolveExportPixelRatio(
  canvas: CanvasSize,
  targetRatio = 2,
  maxEdge = 4096,
): number {
  const safeWidth = Math.max(1, canvas.width);
  const safeHeight = Math.max(1, canvas.height);
  const widthLimit = maxEdge / safeWidth;
  const heightLimit = maxEdge / safeHeight;
  return Math.max(1, Math.min(targetRatio, widthLimit, heightLimit));
}

export const UNFRAMED_CHROME: FrameChrome = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
export type { FramePreset };
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test:sql`
Expected: PASS

- [ ] **Step 5: Lint and commit**

Run: `pnpm lint`

```bash
git add src/features/screenshot-beautifier/layout.ts tests/screenshot-beautifier.test.ts
git commit -m "feat(screenshot-beautifier): add canvas and screenshot-fit geometry"
```

---

### Task 4: Image input validation and clipboard extraction

**Files:**

- Create: `src/features/screenshot-beautifier/image.ts`
- Modify: `tests/screenshot-beautifier.test.ts`

**Interfaces:**

- Produces: `MAX_SCREENSHOT_FILE_SIZE`, `MAX_SCREENSHOT_DIMENSION` (constants), `validateScreenshotFile(file: { type: string; size: number }): string | null`, `validateScreenshotDimensions(size: { width: number; height: number }): string | null`, `extractImageFileFromClipboard(items: readonly Pick<DataTransferItem, 'kind' | 'type' | 'getAsFile'>[]): File | null`, `formatFileSize(bytes: number): string`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/screenshot-beautifier.test.ts`:

```ts
import {
  extractImageFileFromClipboard,
  formatFileSize,
  validateScreenshotDimensions,
  validateScreenshotFile,
} from "../src/features/screenshot-beautifier/image.ts";

test("validateScreenshotFile accepts PNG/JPEG/WebP under the size limit", () => {
  assert.equal(validateScreenshotFile({ type: "image/png", size: 1024 }), null);
  assert.equal(
    validateScreenshotFile({ type: "image/heic", size: 1024 }),
    "Choose a PNG, JPEG, or WebP image.",
  );
  assert.equal(
    validateScreenshotFile({ type: "image/png", size: 20 * 1024 * 1024 + 1 }),
    "Images must be 20 MiB or smaller.",
  );
});

test("validateScreenshotDimensions rejects images over the safety limit", () => {
  assert.equal(validateScreenshotDimensions({ width: 500, height: 500 }), null);
  assert.equal(
    validateScreenshotDimensions({ width: 10_001, height: 500 }),
    "Images must be 10,000 px or smaller on each side.",
  );
});

test("extractImageFileFromClipboard returns the first image file, or null when none is present", () => {
  const imageFile = new File(["x"], "shot.png", { type: "image/png" });
  const withImage = [
    { kind: "string", type: "text/plain", getAsFile: () => null },
    { kind: "file", type: "image/png", getAsFile: () => imageFile },
  ];
  assert.equal(extractImageFileFromClipboard(withImage), imageFile);

  const textOnly = [
    { kind: "string", type: "text/plain", getAsFile: () => null },
  ];
  assert.equal(extractImageFileFromClipboard(textOnly), null);
  assert.equal(extractImageFileFromClipboard([]), null);
});

test("formatFileSize renders bytes, KB, and MB", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2.0 KB");
  assert.equal(formatFileSize(5 * 1024 * 1024), "5.0 MB");
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm test:sql`
Expected: FAIL — `Cannot find module '../src/features/screenshot-beautifier/image.ts'`

- [ ] **Step 3: Implement `image.ts`**

```ts
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const MAX_SCREENSHOT_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_SCREENSHOT_DIMENSION = 10_000;

export function validateScreenshotFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!ACCEPTED_TYPES.has(file.type))
    return "Choose a PNG, JPEG, or WebP image.";
  if (file.size > MAX_SCREENSHOT_FILE_SIZE)
    return "Images must be 20 MiB or smaller.";
  return null;
}

export function validateScreenshotDimensions(size: {
  width: number;
  height: number;
}): string | null {
  if (
    size.width > MAX_SCREENSHOT_DIMENSION ||
    size.height > MAX_SCREENSHOT_DIMENSION
  ) {
    return `Images must be ${MAX_SCREENSHOT_DIMENSION.toLocaleString()} px or smaller on each side.`;
  }
  return null;
}

export function extractImageFileFromClipboard(
  items: readonly Pick<DataTransferItem, "kind" | "type" | "getAsFile">[],
): File | null {
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test:sql`
Expected: PASS

- [ ] **Step 5: Lint and commit**

Run: `pnpm lint`

```bash
git add src/features/screenshot-beautifier/image.ts tests/screenshot-beautifier.test.ts
git commit -m "feat(screenshot-beautifier): add image input validation and clipboard extraction"
```

---

### Task 5: Export filename, rasterization, and clipboard copy

**Files:**

- Create: `src/features/screenshot-beautifier/export.ts`
- Modify: `tests/screenshot-beautifier.test.ts`
- Modify: `package.json` (add `html-to-image` dependency)

**Interfaces:**

- Produces: `exportScreenshotFileName(originalFileName: string | null, extension: 'png' | 'jpg'): string` (pure, tested), `exportCanvasToBlob(node: HTMLElement, format: 'png' | 'jpg', pixelRatio: number, backgroundColor: string): Promise<Blob>` (browser-only, not unit tested), `copyBlobToClipboard(blob: Blob): Promise<void>` (browser-only, not unit tested), `isClipboardImageCopySupported(): boolean`.

- [ ] **Step 1: Add the `html-to-image` dependency**

Run: `pnpm add html-to-image`
Expected: `package.json`/`pnpm-lock.yaml` gain a single new dependency (`html-to-image` is dependency-free and ~10 KB gzipped; it is used only to rasterize our own composed DOM node to a Blob — no network calls, consistent with the CSP already in `public/_headers`).

- [ ] **Step 2: Write the failing test for the pure filename function**

Append to `tests/screenshot-beautifier.test.ts`:

```ts
import { exportScreenshotFileName } from "../src/features/screenshot-beautifier/export.ts";

test("exportScreenshotFileName falls back to a generic name, or derives one from the original file", () => {
  assert.equal(
    exportScreenshotFileName(null, "png"),
    "mindskit-screenshot.png",
  );
  assert.equal(
    exportScreenshotFileName("my-dashboard.png", "jpg"),
    "my-dashboard-beautified.jpg",
  );
  assert.equal(
    exportScreenshotFileName("archive.tar.png", "png"),
    "archive.tar-beautified.png",
  );
});
```

- [ ] **Step 3: Run the tests and confirm the new one fails**

Run: `pnpm test:sql`
Expected: FAIL — `Cannot find module '../src/features/screenshot-beautifier/export.ts'`

- [ ] **Step 4: Implement `export.ts`**

```ts
export function exportScreenshotFileName(
  originalFileName: string | null,
  extension: "png" | "jpg",
): string {
  if (!originalFileName) return `mindskit-screenshot.${extension}`;
  const base = originalFileName.replace(/\.[^./]+$/, "") || "screenshot";
  return `${base}-beautified.${extension}`;
}

export function isClipboardImageCopySupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.clipboard?.write) &&
    typeof ClipboardItem !== "undefined"
  );
}

export async function exportCanvasToBlob(
  node: HTMLElement,
  format: "png" | "jpg",
  pixelRatio: number,
  backgroundColor: string,
): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    pixelRatio,
    backgroundColor,
    type: format === "jpg" ? "image/jpeg" : "image/png",
    quality: format === "jpg" ? 0.9 : undefined,
  });
  if (!blob) throw new Error("Failed to export the composed image.");
  return blob;
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!isClipboardImageCopySupported())
    throw new Error(
      "Copying images is not supported in this browser. Use Download instead.",
    );
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm test:sql`
Expected: PASS (`exportScreenshotFileName` cases; the two async functions have no Node-runnable test — they require a browser DOM and Clipboard API, consistent with `AGENTS.md`'s note that `pnpm test:sql` is not a substitute for browser testing)

- [ ] **Step 6: Lint, typecheck, and commit**

Run: `pnpm lint && pnpm exec tsc -b --noEmit`
Expected: no errors.

```bash
git add src/features/screenshot-beautifier/export.ts tests/screenshot-beautifier.test.ts package.json pnpm-lock.yaml
git commit -m "feat(screenshot-beautifier): add export rasterization and clipboard copy helpers"
```

---

### Task 6: Tool registry, route, and page skeleton

**Files:**

- Modify: `src/config/tools.ts`
- Modify: `src/App.tsx`
- Create: `src/pages/screenshot-beautifier-page.tsx`

**Interfaces:**

- Produces: exported `ScreenshotBeautifierPage` component (default-exportless named export, matching `ImageRemoveBackgroundPage`/`ReadmeBuilderPage`), rendered at `/images/screenshot-beautifier`.
- Consumes: `ToolPageHeader` from `@/components/tool/tool-page-header` (Task 7+ will fill in the body).

- [ ] **Step 1: Register the tool**

In `src/config/tools.ts`, add `Sparkles` to the `lucide-react` import list (alphabetically, after `Shuffle`), then add an entry to the `// Images` block after `remove-background`:

```ts
  {
    id: 'screenshot-beautifier',
    name: 'Screenshot Beautifier',
    description: 'Create polished screenshots with gradients, frames, spacing, shadows, and perspective — directly in your browser.',
    category: 'images',
    path: '/images/screenshot-beautifier',
    icon: Sparkles,
  },
```

- [ ] **Step 2: Add a minimal page skeleton**

Create `src/pages/screenshot-beautifier-page.tsx`:

```tsx
import { ToolPageHeader } from "@/components/tool/tool-page-header";

export function ScreenshotBeautifierPage() {
  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader
        title="Screenshot Beautifier"
        description="Create polished screenshots with gradients, frames, spacing, shadows, and perspective — directly in your browser."
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire the lazy route**

In `src/App.tsx`, add a lazy import next to `ReadmeBuilderPage` (after its `lazy(...)` block):

```tsx
const ScreenshotBeautifierPage = lazy(() =>
  import("@/pages/screenshot-beautifier-page").then((module) => ({
    default: module.ScreenshotBeautifierPage,
  })),
);
```

Add the route after `/images/remove-background`'s `<Route>` block:

```tsx
<Route
  path="/images/screenshot-beautifier"
  element={
    <Suspense
      fallback={<p className="p-4 text-sm text-muted-foreground">Loading…</p>}>
      <ScreenshotBeautifierPage />
    </Suspense>
  }
/>
```

- [ ] **Step 4: Verify it builds and renders**

Run: `pnpm lint && pnpm build`
Expected: no errors; `dist/` builds successfully.

Run: `pnpm dev`, open `/images/screenshot-beautifier` in a browser, and confirm the header renders and the tool appears under **Images** in navigation/search/Quick Actions.

- [ ] **Step 5: Commit**

```bash
git add src/config/tools.ts src/App.tsx src/pages/screenshot-beautifier-page.tsx
git commit -m "feat(screenshot-beautifier): register tool, route, and page skeleton"
```

---

### Task 7: Image input — upload, drag-drop, and clipboard paste

**Files:**

- Modify: `src/pages/screenshot-beautifier-page.tsx`

**Interfaces:**

- Consumes: `validateScreenshotFile`, `validateScreenshotDimensions`, `extractImageFileFromClipboard`, `formatFileSize` from `@/features/screenshot-beautifier/image` (Task 4).
- Produces (page-local state, consumed by Tasks 8–11): `screenshotFile: File | null`, `screenshotUrl: string`, `naturalSize: { width: number; height: number } | null`, `error: string`, plus a `handleFile(file: File)` handler and a `removeImage()` handler.

- [ ] **Step 1: Implement the upload surface**

Replace the skeleton body of `ScreenshotBeautifierPage` in `src/pages/screenshot-beautifier-page.tsx` with state and an upload/drag-drop/paste surface, following the exact pattern used in `src/pages/image-resize-page.tsx:61-96` and `src/pages/image-crop-page.tsx:47-97` (same `useState`/`useRef` shape, same `handleFile` validate → revoke-old-URL → `URL.createObjectURL` → reset-derived-state flow, same drag-over/drag-leave/drop handlers, same empty-state dashed-border button). Reuse `ToolStatus` for errors. Key additions specific to this tool:

```tsx
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { ToolPageHeader } from "@/components/tool/tool-page-header";
import { ToolStatus } from "@/components/tool/tool-status";
import { Button } from "@/components/ui/button";
import {
  extractImageFileFromClipboard,
  formatFileSize,
  validateScreenshotDimensions,
  validateScreenshotFile,
} from "@/features/screenshot-beautifier/image";
import { cn } from "@/lib/utils";

export function ScreenshotBeautifierPage() {
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const validationError = validateScreenshotFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    setScreenshotFile(file);
    setScreenshotUrl(URL.createObjectURL(file));
    setNaturalSize(null);
    setError("");
  };

  const removeImage = () => {
    if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    setScreenshotFile(null);
    setScreenshotUrl("");
    setNaturalSize(null);
    setError("");
  };

  useEffect(() => {
    return () => {
      if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const file = extractImageFileFromClipboard(items);
      if (!file) return;
      event.preventDefault();
      handleFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenshotUrl]);

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader
        title="Screenshot Beautifier"
        description="Create polished screenshots with gradients, frames, spacing, shadows, and perspective — directly in your browser."
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" onClick={() => inputRef.current?.click()}>
          <ImagePlus />
          {screenshotFile ? "Change screenshot" : "Choose screenshot"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) handleFile(selected);
            event.target.value = "";
          }}
        />
        {screenshotFile && (
          <Button type="button" variant="outline" onClick={removeImage}>
            <Trash2 />
            Remove image
          </Button>
        )}
        {naturalSize && screenshotFile && (
          <span className="text-xs text-muted-foreground">
            {screenshotFile.name} · {naturalSize.width} × {naturalSize.height} ·{" "}
            {screenshotFile.type} · {formatFileSize(screenshotFile.size)}
          </span>
        )}
      </div>

      <ToolStatus state={error ? "invalid" : "idle"} message={error} />

      {!screenshotFile ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingFile(false);
            const dropped = event.dataTransfer.files[0];
            if (dropped) handleFile(dropped);
          }}
          className={cn(
            "flex min-h-70 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm transition-colors",
            isDraggingFile && "border-primary bg-primary/5",
          )}>
          <ImagePlus className="size-7 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Drag and drop a screenshot here, paste from your clipboard, or click
            to browse.
          </span>
          <span className="text-xs text-muted-foreground/80">
            PNG, JPEG, or WebP · up to 20 MiB
          </span>
        </button>
      ) : (
        <img
          ref={imageRef}
          src={screenshotUrl}
          alt="Selected screenshot"
          className="hidden"
          onLoad={handleScreenshotLoad}
          onError={handleScreenshotError}
        />
      )}
    </div>
  );
}
```

Define the two handlers as named functions inside the component (above the `return`), not inline, so Tasks 9 and 10 can pass the exact same function references without repeating the logic:

```tsx
const handleScreenshotLoad = (
  event: React.SyntheticEvent<HTMLImageElement>,
) => {
  const image = event.currentTarget;
  const size = { width: image.naturalWidth, height: image.naturalHeight };
  const dimensionError = validateScreenshotDimensions(size);
  if (dimensionError) {
    setError(dimensionError);
    removeImage();
    return;
  }
  setNaturalSize(size);
  setError("");
};

const handleScreenshotError = () => {
  setError("Could not read this image file.");
  removeImage();
};
```

(`imageRef`'s hidden `<img>` stays mounted only to read `naturalWidth`/`naturalHeight` and detect decode failures; Task 9 replaces the `hidden` visible screenshot with the real preview `<img>` inside the composed stage, reusing the same `ref`, `handleScreenshotLoad`, and `handleScreenshotError`.)

- [ ] **Step 2: Verify it builds and lints**

Run: `pnpm lint && pnpm build`
Expected: no errors.

- [ ] **Step 3: Manually verify in the browser**

Run: `pnpm dev`, open `/images/screenshot-beautifier`, and confirm: file picker upload works; drag-and-drop works; pasting a copied image (e.g. a screenshot copied via OS screenshot tool) loads it; pasting non-image clipboard content shows no crash and no image change; an oversized/invalid file shows the inline error via `ToolStatus` and does not replace a previously loaded screenshot; Remove image clears state and revokes the Object URL (check DevTools → Memory or just confirm no console errors on repeated add/remove).

- [ ] **Step 4: Commit**

```bash
git add src/pages/screenshot-beautifier-page.tsx
git commit -m "feat(screenshot-beautifier): add upload, drag-drop, and clipboard paste input"
```

---

### Task 8: Design state and controls panel (background, spacing, canvas size, scale, position)

**Files:**

- Modify: `src/pages/screenshot-beautifier-page.tsx`

**Interfaces:**

- Consumes: `ScreenshotDesign`, `DEFAULT_DESIGN`, `backgroundCss`, `resetDesign` from `@/features/screenshot-beautifier/model`; `GRADIENT_PRESETS`, `findGradientPreset`, `CANVAS_SIZE_PRESETS`, `POSITION_OPTIONS` from `@/features/screenshot-beautifier/presets`; `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` from `@/components/ui/select`.
- Produces: page state `design: ScreenshotDesign` + `setDesign`, consumed by Task 9 (preview), Task 10 (frame/perspective controls), Task 11 (export/reset), Task 12 (persistence).

- [ ] **Step 1: Add design state and the controls panel**

Add design state right after the image-input state added in Task 7, and render a controls panel below the upload row (only when `screenshotFile` is set — mirror `image-resize-page.tsx`'s two-column `grid ... lg:grid-cols-[...]` layout with a controls `<section>` and a preview `<section>`; Task 9 fills in the preview section):

```tsx
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  backgroundCss,
  DEFAULT_DESIGN,
  type ScreenshotDesign,
} from "@/features/screenshot-beautifier/model";
import {
  CANVAS_SIZE_PRESETS,
  findGradientPreset,
  GRADIENT_PRESETS,
  POSITION_OPTIONS,
} from "@/features/screenshot-beautifier/presets";

// inside the component, alongside the Task 7 state:
const [design, setDesign] = useState<ScreenshotDesign>(() => ({
  ...DEFAULT_DESIGN,
  background: { ...DEFAULT_DESIGN.background },
}));

const updateDesign = (patch: Partial<ScreenshotDesign>) =>
  setDesign((current) => ({ ...current, ...patch }));
const updateBackground = (patch: Partial<ScreenshotDesign["background"]>) =>
  setDesign((current) => ({
    ...current,
    background: { ...current.background, ...patch },
  }));
```

Controls panel JSX (rendered inside the two-column grid, left column, only when `screenshotFile` is truthy):

```tsx
<section className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-sm lg:w-75 lg:shrink-0">
  <div className="space-y-2">
    <h2 className="text-sm font-medium">Canvas</h2>
    <Select
      value={design.canvasPreset}
      onValueChange={(value) =>
        updateDesign({
          canvasPreset: value as ScreenshotDesign["canvasPreset"],
        })
      }>
      <SelectTrigger size="sm" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CANVAS_SIZE_PRESETS.map((preset) => (
          <SelectItem key={preset.id} value={preset.id}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div className="space-y-2">
    <h2 className="text-sm font-medium">Background</h2>
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant={design.background.type === "solid" ? "default" : "outline"}
        onClick={() => updateBackground({ type: "solid" })}>
        Solid
      </Button>
      <Button
        type="button"
        size="sm"
        variant={design.background.type === "gradient" ? "default" : "outline"}
        onClick={() => updateBackground({ type: "gradient" })}>
        Gradient
      </Button>
    </div>
    {design.background.type === "solid" ? (
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Color
        <input
          aria-label="Background color"
          type="color"
          value={design.background.color}
          onChange={(event) => updateBackground({ color: event.target.value })}
          className="h-8 w-16 cursor-pointer rounded-lg border border-input bg-transparent p-1"
        />
      </label>
    ) : (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-label={preset.name}
              title={preset.name}
              onClick={() =>
                updateBackground({
                  gradientFrom: preset.from,
                  gradientTo: preset.to,
                  gradientAngle: preset.angle,
                  gradientPresetId: preset.id,
                })
              }
              className={cn(
                "size-7 rounded-full border-2",
                design.background.gradientPresetId === preset.id
                  ? "border-primary"
                  : "border-transparent",
              )}
              style={{
                background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            aria-label="Gradient start color"
            type="color"
            value={design.background.gradientFrom}
            onChange={(event) =>
              updateBackground({
                gradientFrom: event.target.value,
                gradientPresetId: null,
              })
            }
            className="h-8 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
          />
          <input
            aria-label="Gradient end color"
            type="color"
            value={design.background.gradientTo}
            onChange={(event) =>
              updateBackground({
                gradientTo: event.target.value,
                gradientPresetId: null,
              })
            }
            className="h-8 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
          />
          <label className="flex flex-1 items-center gap-1.5">
            Angle {design.background.gradientAngle}°
            <input
              aria-label="Gradient angle"
              type="range"
              min="0"
              max="360"
              value={design.background.gradientAngle}
              onChange={(event) =>
                updateBackground({
                  gradientAngle: Number(event.target.value),
                  gradientPresetId: null,
                })
              }
              className="flex-1 accent-primary"
            />
          </label>
        </div>
      </div>
    )}
  </div>

  <label className="space-y-1.5 text-xs text-muted-foreground">
    Padding {design.padding}px
    <input
      aria-label="Padding"
      type="range"
      min={0}
      max={200}
      value={design.padding}
      onChange={(event) =>
        updateDesign({ padding: Number(event.target.value) })
      }
      className="block w-full accent-primary"
    />
  </label>

  <label className="space-y-1.5 text-xs text-muted-foreground">
    Radius {design.radius}px
    <input
      aria-label="Border radius"
      type="range"
      min={0}
      max={48}
      value={design.radius}
      onChange={(event) => updateDesign({ radius: Number(event.target.value) })}
      className="block w-full accent-primary"
    />
  </label>

  <div className="space-y-1.5">
    <h2 className="text-sm font-medium">Shadow</h2>
    <div className="flex flex-wrap gap-1.5">
      {(["none", "soft", "medium", "strong"] as const).map((level) => (
        <Button
          key={level}
          type="button"
          size="sm"
          variant={design.shadow === level ? "default" : "outline"}
          onClick={() => updateDesign({ shadow: level })}>
          {level[0].toUpperCase() + level.slice(1)}
        </Button>
      ))}
    </div>
  </div>

  <label className="space-y-1.5 text-xs text-muted-foreground">
    Scale {design.scale}%
    <input
      aria-label="Screenshot scale"
      type="range"
      min={50}
      max={120}
      value={design.scale}
      onChange={(event) => updateDesign({ scale: Number(event.target.value) })}
      className="block w-full accent-primary"
    />
  </label>

  <div className="space-y-1.5">
    <h2 className="text-sm font-medium">Position</h2>
    <div className="flex flex-wrap gap-1.5">
      {POSITION_OPTIONS.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={design.position === option.id ? "default" : "outline"}
          onClick={() => updateDesign({ position: option.id })}>
          {option.label}
        </Button>
      ))}
    </div>
  </div>
</section>
```

Note: `backgroundCss(design.background)` and `findGradientPreset` are consumed by Task 9's preview stage, not this task — this task only writes to `design.background`, it doesn't read it back into CSS yet.

- [ ] **Step 2: Verify it builds and lints**

Run: `pnpm lint && pnpm build`
Expected: no errors. (The preview section referenced by the two-column grid doesn't exist yet — leave a simple placeholder `<section>` with `Preview coming in Task 9` text so the grid layout is visibly correct; Task 9 replaces that placeholder.)

- [ ] **Step 3: Manually verify in the browser**

Run: `pnpm dev`. Confirm every control updates `design` state without crashing (you can temporarily add `{JSON.stringify(design)}` under the controls to eyeball state changes, then remove it before committing). Confirm keyboard focus reaches every control (Tab through the panel) and focus rings are visible.

- [ ] **Step 4: Commit**

```bash
git add src/pages/screenshot-beautifier-page.tsx
git commit -m "feat(screenshot-beautifier): add design state and background/spacing/canvas controls"
```

---

### Task 9: Live preview stage (background, padding, radius, shadow, scale, position)

**Files:**

- Modify: `src/pages/screenshot-beautifier-page.tsx`

**Interfaces:**

- Consumes: `resolveCanvasSize`, `resolveFittedScreenshotSize` from `@/features/screenshot-beautifier/layout`; `SHADOW_CSS`, `POSITION_ALIGN`, `FRAME_CHROME` from `@/features/screenshot-beautifier/presets`; `backgroundCss` from `@/features/screenshot-beautifier/model`.
- Produces: `stageRef: RefObject<HTMLDivElement>` (the exact, untransformed, full-resolution composition node — Task 11 passes this to `exportCanvasToBlob`), `canvasSize: { width: number; height: number }` (also consumed by Task 11 for `resolveExportPixelRatio`).

- [ ] **Step 1: Replace the preview placeholder with the scaled stage**

Add a `stageWrapperRef` (measures available space) and `stageRef` (the real, unscaled composition), a `previewScale` state updated via `ResizeObserver`, and render the stage:

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import {
  resolveCanvasSize,
  resolveFittedScreenshotSize,
} from "@/features/screenshot-beautifier/layout";
import {
  FRAME_CHROME,
  POSITION_ALIGN,
  SHADOW_CSS,
} from "@/features/screenshot-beautifier/presets";

// inside the component:
const stageWrapperRef = useRef<HTMLDivElement>(null);
const stageRef = useRef<HTMLDivElement>(null);
const [previewScale, setPreviewScale] = useState(1);

const canvasSize = naturalSize
  ? resolveCanvasSize(design, naturalSize)
  : { width: 1, height: 1 };
const chrome = FRAME_CHROME[design.frame];
const fitted = naturalSize
  ? resolveFittedScreenshotSize(
      canvasSize,
      design.padding,
      chrome,
      naturalSize,
      design.scale,
    )
  : { width: 1, height: 1 };
const align = POSITION_ALIGN[design.position];

useLayoutEffect(() => {
  const wrapper = stageWrapperRef.current;
  if (!wrapper) return;
  const observer = new ResizeObserver(() => {
    const availableWidth = wrapper.clientWidth;
    const availableHeight = wrapper.clientHeight;
    if (
      availableWidth === 0 ||
      availableHeight === 0 ||
      canvasSize.width === 0 ||
      canvasSize.height === 0
    )
      return;
    setPreviewScale(
      Math.min(
        1,
        availableWidth / canvasSize.width,
        availableHeight / canvasSize.height,
      ),
    );
  });
  observer.observe(wrapper);
  return () => observer.disconnect();
}, [canvasSize.width, canvasSize.height]);
```

Preview `<section>` (replaces the Task 8 placeholder, right column of the grid, `flex-1`):

```tsx
<section className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
  <h2 className="text-sm font-medium">Preview</h2>
  <div
    ref={stageWrapperRef}
    className="flex min-h-70 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted/30 p-3">
    {naturalSize && (
      <div
        style={{
          width: canvasSize.width * previewScale,
          height: canvasSize.height * previewScale,
        }}>
        <div
          style={{
            transform: `scale(${previewScale})`,
            transformOrigin: "top left",
            width: canvasSize.width,
            height: canvasSize.height,
          }}>
          <div
            ref={stageRef}
            role="img"
            aria-label="Beautified screenshot preview"
            className="flex"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              background: backgroundCss(design.background),
              justifyContent: align.justify,
              alignItems: align.align,
            }}>
            <div
              style={{
                width: fitted.width + chrome.left + chrome.right,
                height: fitted.height + chrome.top + chrome.bottom,
                borderRadius: design.radius,
                overflow: "hidden",
                boxShadow: SHADOW_CSS[design.shadow],
              }}>
              <img
                ref={imageRef}
                src={screenshotUrl}
                alt="Selected screenshot"
                onLoad={handleScreenshotLoad}
                onError={handleScreenshotError}
                style={{
                  width: fitted.width,
                  height: fitted.height,
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
</section>
```

Move the `onLoad`/`onError` handlers from Task 7's hidden `<img>` onto this visible `<img>`, and delete the Task 7 hidden `<img>` block entirely — this element now serves both purposes (reads natural size _and_ renders in the composition). `backgroundCss` needs importing from `@/features/screenshot-beautifier/model` alongside the existing `DEFAULT_DESIGN`/`ScreenshotDesign` import.

- [ ] **Step 2: Verify it builds and lints**

Run: `pnpm lint && pnpm build`

- [ ] **Step 3: Manually verify in the browser**

Load a screenshot and confirm: the preview shows the screenshot on the chosen background; padding/radius/shadow/scale/position/canvas-preset controls all update the preview live with no "Apply" step; resizing the browser window rescales the preview without clipping or overflow; switching between a very wide and a very tall screenshot doesn't break layout; a fixed canvas preset noticeably smaller than the screenshot still shows the whole screenshot shrunk to fit (never cropped or distorted).

- [ ] **Step 4: Commit**

```bash
git add src/pages/screenshot-beautifier-page.tsx
git commit -m "feat(screenshot-beautifier): compose the live preview stage"
```

---

### Task 10: Frame chrome (browser + device) and perspective

**Files:**

- Modify: `src/pages/screenshot-beautifier-page.tsx`

**Interfaces:**

- Consumes: `FRAME_OPTIONS`, `PERSPECTIVE_PRESETS` from `@/features/screenshot-beautifier/presets`.
- Produces: a local `FrameChromeOverlay({ frame }: { frame: FramePreset })` component rendering the top/bottom decorative bars, used inside Task 9's frame box; adds `frame` and perspective controls to Task 8's controls panel.

- [ ] **Step 1: Add the frame chrome overlay component**

Add this local component in `screenshot-beautifier-page.tsx` (same file, below the page component, matching the `EncoderEditor`/`DecodedSection` local-component convention in `src/pages/jwt-decoder-page.tsx:332,344`):

```tsx
import type { FramePreset } from "@/features/screenshot-beautifier/model";

const BEZEL_COLOR = "#1F2023";
const BEZEL_ACCENT = "#3A3B3F";
const BROWSER_BAR_COLOR = "#E5E7EB";
const BROWSER_DOT_COLORS = ["#9CA3AF", "#9CA3AF", "#9CA3AF"];
const BROWSER_MACOS_DOT_COLORS = ["#EF7A73", "#F5C065", "#61C454"];

function FrameChromeOverlay({ frame }: { frame: FramePreset }) {
  if (frame === "browser-minimal" || frame === "browser-macos") {
    const dots =
      frame === "browser-macos" ? BROWSER_MACOS_DOT_COLORS : BROWSER_DOT_COLORS;
    return (
      <div
        style={{
          background: BROWSER_BAR_COLOR,
          height: frame === "browser-macos" ? 36 : 28,
        }}
        className="flex shrink-0 items-center gap-1.5 px-3">
        {dots.map((color, index) => (
          <span
            key={index}
            style={{ background: color }}
            className="size-2.5 rounded-full"
          />
        ))}
        {frame === "browser-macos" && (
          <span className="mx-auto h-4 w-2/3 max-w-64 rounded-full bg-black/10" />
        )}
      </div>
    );
  }
  if (frame === "device-laptop") {
    return (
      <div
        style={{ background: BEZEL_ACCENT, height: 34 }}
        className="flex shrink-0 items-center justify-center">
        <span className="h-1.5 w-16 rounded-full bg-black/20" />
      </div>
    );
  }
  if (frame === "device-phone-portrait" || frame === "device-phone-landscape") {
    return (
      <div
        style={{
          background: BEZEL_COLOR,
          height: frame === "device-phone-portrait" ? 20 : 10,
        }}
        className="flex shrink-0 items-center justify-center">
        <span className="h-1 w-10 rounded-full bg-white/30" />
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 2: Wrap the screenshot with bezel padding and top/bottom chrome inside Task 9's frame box**

In the frame box `<div>` from Task 9 (the one with `borderRadius`/`overflow: hidden`/`boxShadow`), change its background and children so device frames show a bezel background and browser/device chrome bars appear:

```tsx
<div
  style={{
    width: fitted.width + chrome.left + chrome.right,
    height: fitted.height + chrome.top + chrome.bottom,
    borderRadius: design.radius,
    overflow: "hidden",
    boxShadow: SHADOW_CSS[design.shadow],
    background: design.frame.startsWith("device-") ? BEZEL_COLOR : undefined,
    display: "flex",
    flexDirection: "column",
  }}>
  <FrameChromeOverlay frame={design.frame} />
  <div
    style={{
      display: "flex",
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    }}>
    <img
      ref={imageRef}
      src={screenshotUrl}
      alt="Selected screenshot"
      onLoad={handleScreenshotLoad}
      onError={handleScreenshotError}
      style={{ width: fitted.width, height: fitted.height, display: "block" }}
    />
  </div>
  {(design.frame === "device-laptop" ||
    design.frame === "device-phone-portrait" ||
    design.frame === "device-phone-landscape") && (
    <div
      style={{ background: BEZEL_COLOR, height: chrome.bottom }}
      className="flex shrink-0 items-center justify-center">
      {design.frame === "device-laptop" && (
        <span className="h-1.5 w-24 rounded-t bg-black/30" />
      )}
    </div>
  )}
</div>
```

(`BEZEL_COLOR` is the constant defined in `FrameChromeOverlay`'s module scope above, reused here as-is — do not redefine it. Left/right bezel width needs no explicit `paddingLeft`/`paddingRight`: every `FRAME_CHROME` entry in `presets.ts` (Task 2) has `left === right`, and the middle row is `flex: 1` with `justifyContent: 'center'` inside an outer box already sized to `fitted.width + chrome.left + chrome.right`, so centering the fixed-`fitted.width` image inside that full-width row leaves exactly `chrome.left` on one side and `chrome.right` on the other automatically. If a future frame preset ever needs asymmetric left/right bezel, add explicit `paddingLeft`/`paddingRight` to the middle row instead of relying on centering — not needed for any preset defined in this plan.)

- [ ] **Step 3: Add frame and perspective controls to the controls panel**

Append to the controls panel `<section>` from Task 8:

```tsx
<div className="space-y-1.5">
  <h2 className="text-sm font-medium">Frame</h2>
  <div className="flex flex-wrap gap-1.5">
    {FRAME_OPTIONS.map((option) => (
      <Button key={option.id} type="button" size="sm" variant={design.frame === option.id ? 'default' : 'outline'} onClick={() => updateDesign({ frame: option.id })}>
        {option.label}
      </Button>
    ))}
  </div>
</div>

<div className="space-y-1.5">
  <h2 className="text-sm font-medium">Perspective</h2>
  <div className="flex flex-wrap gap-1.5">
    {PERSPECTIVE_PRESETS.map((preset) => (
      <Button
        key={preset.id}
        type="button"
        size="sm"
        variant={design.perspectiveX === preset.x && design.perspectiveY === preset.y ? 'default' : 'outline'}
        onClick={() => updateDesign({ perspectiveX: preset.x, perspectiveY: preset.y })}
      >
        {preset.label}
      </Button>
    ))}
  </div>
  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
    Rotate X {design.perspectiveX}°
    <input aria-label="Rotate X" type="range" min={-15} max={15} value={design.perspectiveX} onChange={(event) => updateDesign({ perspectiveX: Number(event.target.value) })} className="flex-1 accent-primary" />
  </label>
  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
    Rotate Y {design.perspectiveY}°
    <input aria-label="Rotate Y" type="range" min={-15} max={15} value={design.perspectiveY} onChange={(event) => updateDesign({ perspectiveY: Number(event.target.value) })} className="flex-1 accent-primary" />
  </label>
</div>
```

- [ ] **Step 4: Apply the perspective transform to the frame box**

Add `transform: perspective(1000px) rotateX(${design.perspectiveX}deg) rotateY(${design.perspectiveY}deg)` to the frame box's `style` (the same element styled in Step 2), so the whole framed screenshot tilts while the outer stage (background/canvas size) stays flat.

- [ ] **Step 5: Verify it builds and lints**

Run: `pnpm lint && pnpm build`

- [ ] **Step 6: Manually verify in the browser**

Confirm: None/Minimal Browser/macOS Browser/Phone Portrait/Phone Landscape/Laptop each render distinct, generic (non-branded) chrome; radius applied to the screenshot doesn't visually break out of the frame box at any radius 0–48; perspective presets and the Rotate X/Y sliders tilt the whole framed screenshot smoothly and reset cleanly back to flat at 0/0.

- [ ] **Step 7: Commit**

```bash
git add src/pages/screenshot-beautifier-page.tsx
git commit -m "feat(screenshot-beautifier): add browser/device frame chrome and perspective controls"
```

---

### Task 11: Export, copy, reset, and processing states

**Files:**

- Modify: `src/pages/screenshot-beautifier-page.tsx`

**Interfaces:**

- Consumes: `resolveExportPixelRatio` from `@/features/screenshot-beautifier/layout`; `exportCanvasToBlob`, `copyBlobToClipboard`, `exportScreenshotFileName`, `isClipboardImageCopySupported` from `@/features/screenshot-beautifier/export`; `resetDesign` from `@/features/screenshot-beautifier/model`; `toast` from `sonner` (used the same way as `src/hooks/use-copy.ts`).
- Produces: `exportStatus: 'idle' | 'preparing' | 'exporting' | 'copying'`, `lastResultUrl: string` (kept only for revocation bookkeeping, not shown as a persistent download link — spec calls for direct file downloads).

- [ ] **Step 1: Implement export/copy/reset/remove actions**

```tsx
import { toast } from "sonner";
import { Copy, Download, RotateCcw } from "lucide-react";
import { resolveExportPixelRatio } from "@/features/screenshot-beautifier/layout";
import {
  copyBlobToClipboard,
  exportCanvasToBlob,
  exportScreenshotFileName,
  isClipboardImageCopySupported,
} from "@/features/screenshot-beautifier/export";
import { resetDesign } from "@/features/screenshot-beautifier/model";

// inside the component:
const [exportStatus, setExportStatus] = useState<
  "idle" | "preparing" | "exporting" | "copying"
>("idle");
const lastResultUrlRef = useRef("");

const backgroundColorForExport =
  design.background.type === "solid"
    ? design.background.color
    : design.background.gradientFrom;

const runExport = async (format: "png" | "jpg") => {
  if (!stageRef.current || exportStatus !== "idle") return;
  setExportStatus("preparing");
  try {
    const pixelRatio = resolveExportPixelRatio(canvasSize);
    setExportStatus("exporting");
    const blob = await exportCanvasToBlob(
      stageRef.current,
      format,
      pixelRatio,
      backgroundColorForExport,
    );
    if (lastResultUrlRef.current) URL.revokeObjectURL(lastResultUrlRef.current);
    const url = URL.createObjectURL(blob);
    lastResultUrlRef.current = url;
    const filename = exportScreenshotFileName(
      screenshotFile?.name ?? null,
      format,
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    toast.success(`Exported ${filename}`);
  } catch {
    toast.error("Failed to export this screenshot.");
  } finally {
    setExportStatus("idle");
  }
};

const runCopy = async () => {
  if (!stageRef.current || exportStatus !== "idle") return;
  if (!isClipboardImageCopySupported()) {
    toast.error(
      "Copying images is not supported in this browser. Use Download instead.",
    );
    return;
  }
  setExportStatus("copying");
  try {
    const pixelRatio = resolveExportPixelRatio(canvasSize);
    const blob = await exportCanvasToBlob(
      stageRef.current,
      "png",
      pixelRatio,
      backgroundColorForExport,
    );
    await copyBlobToClipboard(blob);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Could not copy the image. Use Download instead.");
  } finally {
    setExportStatus("idle");
  }
};

const resetToDefaults = () => setDesign(resetDesign());

useEffect(() => {
  return () => {
    if (lastResultUrlRef.current) URL.revokeObjectURL(lastResultUrlRef.current);
  };
}, []);
```

- [ ] **Step 2: Add the action bar**

Render below the two-column grid (Task 8/9), only when `screenshotFile` is set:

```tsx
<div className="flex shrink-0 flex-wrap items-center gap-2">
  <Button
    type="button"
    variant="outline"
    onClick={resetToDefaults}
    disabled={exportStatus !== "idle"}>
    <RotateCcw />
    Reset
  </Button>
  <Button
    type="button"
    variant="outline"
    onClick={() => void runCopy()}
    disabled={exportStatus !== "idle"}>
    <Copy />
    {exportStatus === "copying" ? "Copying…" : "Copy image"}
  </Button>
  <Button
    type="button"
    onClick={() => void runExport("png")}
    disabled={exportStatus !== "idle"}>
    <Download />
    {exportStatus === "preparing" || exportStatus === "exporting"
      ? "Exporting…"
      : "Export PNG"}
  </Button>
  <Button
    type="button"
    variant="secondary"
    onClick={() => void runExport("jpg")}
    disabled={exportStatus !== "idle"}>
    <Download />
    Export JPG
  </Button>
</div>
```

- [ ] **Step 3: Verify it builds and lints**

Run: `pnpm lint && pnpm build`

- [ ] **Step 4: Manually verify in the browser**

Confirm: Export PNG and Export JPG download files named per `exportScreenshotFileName` (generic `mindskit-screenshot.png`/`.jpg` with no screenshot name available — not applicable here since a file is always loaded before these buttons render — and `<original>-beautified.<ext>` otherwise); opening the downloaded files shows the full composition (background/frame/shadow/perspective) at roughly 2x the on-screen preview resolution; Copy image places a PNG on the system clipboard that pastes into another app; clicking Export/Copy repeatedly while one is in flight does nothing until it finishes (buttons are disabled); Reset restores every control to its default while keeping the loaded screenshot; test Copy image in a browser without Clipboard image-write support (or temporarily stub `isClipboardImageCopySupported` to return `false`) and confirm a clear toast appears and Download still works.

- [ ] **Step 5: Commit**

```bash
git add src/pages/screenshot-beautifier-page.tsx
git commit -m "feat(screenshot-beautifier): add export, copy, and reset actions"
```

---

### Task 12: Preference persistence (canvas preset, gradient preset, frame)

**Files:**

- Modify: `src/pages/screenshot-beautifier-page.tsx`

**Interfaces:**

- Consumes: `usePersistedInput` from `@/hooks/use-persisted-input`, `useSaveLocally` from `@/hooks/use-save-locally` (exact pattern from `src/pages/numbers-to-letters-page.tsx:38-39`); `mergePersistedPreferences`, `serializePersistedPreferences` from `@/features/screenshot-beautifier/model` (Task 1); `findGradientPreset` from `@/features/screenshot-beautifier/presets` (Task 2).

- [ ] **Step 1: Wire persistence into design state**

Replace the `design` state initializer from Task 8 and add a persistence-sync effect:

```tsx
import { usePersistedInput } from "@/hooks/use-persisted-input";
import { useSaveLocally } from "@/hooks/use-save-locally";
import {
  mergePersistedPreferences,
  serializePersistedPreferences,
} from "@/features/screenshot-beautifier/model";
import { findGradientPreset } from "@/features/screenshot-beautifier/presets";

// inside the component, before the `design` state:
const { enabled: rememberInputEnabled } = useSaveLocally();
const [storedPrefs, setStoredPrefs] = usePersistedInput(
  "screenshot-beautifier-prefs",
  rememberInputEnabled,
);

const [design, setDesign] = useState<ScreenshotDesign>(() =>
  mergePersistedPreferences(
    { ...DEFAULT_DESIGN, background: { ...DEFAULT_DESIGN.background } },
    storedPrefs,
    (id) => findGradientPreset(id),
  ),
);

useEffect(() => {
  if (!rememberInputEnabled) return;
  setStoredPrefs(serializePersistedPreferences(design));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  rememberInputEnabled,
  design.canvasPreset,
  design.background.gradientPresetId,
  design.frame,
]);
```

`ToolPageHeader` already renders the shared "Remember input" checkbox by default (`showRememberInput` defaults to `true` — do not pass `showRememberInput={false}` on this page, unlike the resize/crop pages).

- [ ] **Step 2: Verify it builds and lints**

Run: `pnpm lint && pnpm build`

- [ ] **Step 3: Manually verify in the browser**

With "Remember input" off (default): change canvas preset/gradient/frame, reload the page, confirm defaults come back (nothing persisted). Turn "Remember input" on, change canvas preset to `1:1`, gradient to "Sunset Ember", frame to "macOS-style browser"; reload the page (image itself will be gone — that's expected, the screenshot is never persisted); load a new screenshot and confirm canvas preset/gradient/frame come back as last set. Turn "Remember input" back off and confirm the `mindskit:input:screenshot-beautifier-prefs` key is removed from `localStorage` (DevTools → Application → Local Storage).

- [ ] **Step 4: Commit**

```bash
git add src/pages/screenshot-beautifier-page.tsx
git commit -m "feat(screenshot-beautifier): persist canvas preset, gradient preset, and frame preferences"
```

---

### Task 13: Documentation and full manual verification pass

**Files:**

- Modify: `CONTEXT.md`
- Modify: `README.md`

**Interfaces:** None (docs only).

- [ ] **Step 1: Update `CONTEXT.md`**

In the `Current Scope` table (`CONTEXT.md:55`), change the `Images` row to:

```
| Images (`images`) | Image Resize, Image Crop, Remove Background, Screenshot Beautifier |
```

Update the tool count in the intro line (`CONTEXT.md:44`, "There are 50 registered tools" → 51). After the Image Resize bullet (`CONTEXT.md:67`), add:

```
- Screenshot Beautifier (`/images/screenshot-beautifier`) composes a loaded PNG/JPEG/WebP screenshot (up to 20 MiB, 10,000 px per side) with a solid or gradient background, padding, radius, shadow, canvas-size preset, generic browser/device frame chrome, and perspective tilt, then exports PNG/JPG at up to 2x pixel density (capped at 4096 px per edge) via `html-to-image`, or copies the PNG to the clipboard. The screenshot and export never leave the browser; only the last-used canvas preset, gradient preset, and frame persist, and only when Remember input is enabled, under the existing `mindskit:input:<key>` mechanism.
```

In `Persistence and Privacy` (`CONTEXT.md:74`), the existing bullet about `usePersistedInput` already covers this — no change needed there, but confirm it still reads correctly after the addition above.

- [ ] **Step 2: Update `README.md`**

Read `README.md`'s tool listing/table (mirror whatever structure it already uses for the Images category — check the current file before editing, since `CONTEXT.md:11` notes the README can lag behind source) and add a Screenshot Beautifier entry consistent with the existing Image Resize/Image Crop/Remove Background entries' level of detail.

- [ ] **Step 3: Run the full verification suite**

Run: `pnpm lint`
Run: `pnpm exec tsc -b --noEmit` (or `pnpm build`, which includes the type-check)
Run: `pnpm build`
Run: `pnpm test:sql`
Expected: all four pass with no errors.

- [ ] **Step 4: Full manual browser pass**

Run: `pnpm dev`. Work through every item from the spec's Manual Verification list (`docs/plan/screenshot_beatifier_plan.md:825-853`): upload PNG; upload JPG; paste from clipboard; drag/drop; solid background; gradient background; gradient preset; padding; border radius; shadow; canvas presets; browser frame; device frame; scale; position; perspective; reset; PNG export; JPG export; copy image; light theme; dark theme; mobile layout (resize the browser to a narrow width or use device emulation and confirm controls stack below the preview with no horizontal overflow and touch-sized buttons); large image handling (a screenshot near 8–10k px on a side); invalid input handling (wrong file type, oversized file, non-image clipboard paste). Also switch through all six named themes (not just light/dark) and confirm the inspector UI reads correctly while the exported artwork's own colors stay unaffected by the theme, per the Global Constraints.

- [ ] **Step 5: Commit**

```bash
git add CONTEXT.md README.md
git commit -m "docs: document the Screenshot Beautifier tool"
```
