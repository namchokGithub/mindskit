# README Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only README Builder that creates, imports, previews, exports, validates, and locally saves structured README documents.

**Architecture:** A deep feature module owns document model, templates, Markdown rendering/importing, validation, and IndexedDB storage. The page owns selection, responsive layout, dialogs, and bounded history, then renders the feature module’s Markdown in the existing preview stack.

**Tech Stack:** React 19, TypeScript 6, existing CodeMirror, React Markdown, Radix, lucide-react, native drag-and-drop, IndexedDB, Node test runner.

**Spec:** `docs/plan/readme-builder-design.md`

## Global Constraints

- Process and store README text only in the browser; add no backend, analytics, authentication, or third-party content-processing API.
- Add no npm dependency.
- Register Text Tools route `/text-tools/readme-builder` in both `src/config/tools.ts` and `src/App.tsx`.
- Preserve the 10 MiB file limit and `.md,.markdown,.txt` filters.
- Do not persist secrets; update `README.md` and `CONTEXT.md` when shipped.

## Review Focus

- Unknown Markdown, tables, HTML, and fenced code import into Custom Sections without loss.
- Punctuation and repeated headings generate stable, collision-free TOC anchors.
- IndexedDB failures retain in-memory work and display an actionable error.
- Every reorder works with buttons as well as native DnD.
- Template replacement, New/Reset, and draft deletion confirm before replacing local work.

---

## File structure

- Create `src/features/readme-builder/model.ts`: serializable types, section library/templates, immutable editing helpers, validation, and pure history.
- Create `src/features/readme-builder/markdown.ts`: renderer, TOC slugging, badge URL generation, and conservative importer.
- Create `src/features/readme-builder/drafts.ts`: IndexedDB adapter.
- Create `src/pages/readme-builder-page.tsx`: workspace UI and browser side effects.
- Create `tests/readme-builder.test.ts`: Node tests for every pure module.
- Modify `src/config/tools.ts`, `src/App.tsx`, `README.md`, and `CONTEXT.md`.

### Task 1: Implement the document model and templates

**Files:**
- Create: `src/features/readme-builder/model.ts`
- Create: `tests/readme-builder.test.ts`

**Interfaces:**
- Produces `ProjectType` = `'blank' | 'web-app' | 'frontend-app' | 'backend-api' | 'cli-tool' | 'library-package' | 'mobile-app' | 'full-stack-app'`.
- Produces `SectionKind` for all 19 library entries; `ReadmeSection = { id; kind; title; visible; fields: Record<string, string>; body }`; `ReadmeBadge = { id; label; message; color; link }`; and `ReadmeDocument = { version: 1; id; name; title; projectType; includeTableOfContents; badges; sections }`.
- Produces `createDocument(projectType?: ProjectType)`, `applyTemplate(projectType)`, `addSection(document, kind)`, `updateSection(document, id, update)`, `duplicateSection(document, id)`, `moveSection(document, id, targetIndex)`, `validateDocument(document)`, and `pushHistory(history, next, limit = 50)`.

- [ ] **Step 1: Write the failing template and mutation tests**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, duplicateSection, moveSection, validateDocument } from '../src/features/readme-builder/model.ts'

test('frontend template preloads its documented section order', () => {
  assert.deepEqual(createDocument('frontend-app').sections.map((section) => section.kind), [
    'overview', 'live-demo', 'screenshots', 'features', 'tech-stack',
    'installation', 'scripts', 'deployment', 'license',
  ])
})

test('duplicate and move retain unique ids without mutating input', () => {
  const source = createDocument()
  const next = moveSection(duplicateSection(source, source.sections[0].id), source.sections[0].id, 1)
  assert.equal(new Set(next.sections.map((section) => section.id)).size, next.sections.length)
  assert.equal(source.sections.length, 7)
})

test('validation rejects a blank README title and duplicate visible headings', () => {
  assert.ok(validateDocument({ ...createDocument('blank'), title: '' }).some((issue) => issue.code === 'document-title-required'))
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/readme-builder.test.ts`

Expected: FAIL because the feature module does not exist.

- [ ] **Step 3: Implement the model**

Define one section-library record per kind with default title, edit field definitions, and defaults. Define all eight documented templates and ensure general new documents contain the seven default sections. Return fresh objects and UUIDs from every constructor; never mutate arguments. Validation must emit typed issues for blank document title, blank visible custom title, duplicate visible headings, and sections whose required fields/body are empty.

- [ ] **Step 4: Add history-limit tests**

```ts
test('history keeps the newest 50 immutable snapshots', () => {
  const snapshots = Array.from({ length: 51 }, (_, index) => ({ ...createDocument(), name: String(index) }))
  const history = snapshots.reduce((current, next) => pushHistory(current, next), [])
  assert.equal(history.length, 50)
  assert.equal(history[0].name, '1')
})
```

- [ ] **Step 5: Run and commit**

Run: `node --test tests/readme-builder.test.ts`

Expected: PASS.

```bash
git add src/features/readme-builder/model.ts tests/readme-builder.test.ts
git commit -m "feat(readme-builder): add structured document model"
```

### Task 2: Implement Markdown rendering and import

**Files:**
- Create: `src/features/readme-builder/markdown.ts`
- Modify: `tests/readme-builder.test.ts`

**Interfaces:**
- Consumes `ReadmeDocument`, `ReadmeSection`, and `ReadmeBadge`.
- Produces `renderReadme(document): string`, `importReadme(markdown): { document: ReadmeDocument; notices: string[] }`, `createBadgeUrl(badge): string`, and `createTocEntries(document): Array<{ title: string; href: string }>`.

- [ ] **Step 1: Write failing renderer/import tests**

```ts
import { createTocEntries, importReadme, renderReadme } from '../src/features/readme-builder/markdown.ts'

test('renderer preserves visible section order and TOC collisions', () => {
  const markdown = renderReadme(documentWithTwoVisibleSectionsNamed('API'))
  assert.match(markdown, /- \[API\]\(#api\)\n- \[API\]\(#api-1\)/)
  assert.doesNotMatch(markdown, /Hidden section/)
})

test('import preserves unfamiliar content in a custom section', () => {
  const result = importReadme('# Repo\n\n## Mermaid\n\n\`\`\`mermaid\ngraph TD\n\`\`\`')
  assert.equal(result.document.sections.at(-1)?.kind, 'custom')
  assert.match(result.document.sections.at(-1)?.body ?? '', /mermaid/)
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/readme-builder.test.ts`

Expected: FAIL because `markdown.ts` does not exist.

- [ ] **Step 3: Implement deterministic rendering and a conservative importer**

The renderer writes H1, optional badge line, optional TOC, then visible sections in exact order. It uses library renderers for fields, appends nonempty raw `body` untouched, omits empty sections, and uses `##` headings. Generate badge URLs with `encodeURIComponent`; a link wraps the badge only when supplied. Build lowercase ASCII slugs, collapsing separators and suffixing duplicate anchors `-1`, `-2`.

The importer recognizes only an initial H1 and top-level H2 blocks matching a library title. Preserve unknown headings and every unsupported construct (including HTML/tables/code fences) as custom bodies and return notices; it must not attempt a lossy full Markdown AST conversion.

- [ ] **Step 4: Add Review Focus tests**

```ts
test('TOC slugging handles punctuation and duplicates', () => {
  assert.deepEqual(createTocEntries(documentWithTitles(['C++ & API!', 'C++ & API!'])).map((item) => item.href), ['#c-api', '#c-api-1'])
})

test('raw HTML stays in the imported custom body', () => {
  assert.match(importReadme('# R\n\n## Diagram\n\n<table><tr><td>x</td></tr></table>').document.sections.at(-1)?.body ?? '', /<table>/)
})
```

- [ ] **Step 5: Run and commit**

Run: `node --test tests/readme-builder.test.ts`

Expected: PASS.

```bash
git add src/features/readme-builder/markdown.ts tests/readme-builder.test.ts
git commit -m "feat(readme-builder): render and import README markdown"
```

### Task 3: Implement local draft storage

**Files:**
- Create: `src/features/readme-builder/drafts.ts`
- Modify: `tests/readme-builder.test.ts`

**Interfaces:**
- Consumes `ReadmeDocument`.
- Produces `ReadmeDraftSummary = { id; name; updatedAt }`, `listDrafts(): Promise<ReadmeDraftSummary[]>`, `loadDraft(id): Promise<ReadmeDocument | null>`, `saveDraft(document): Promise<ReadmeDraftSummary>`, `renameDraft(id, name): Promise<void>`, and `deleteDraft(id): Promise<void>`.

- [ ] **Step 1: Add tests for the pure error and history contracts**

```ts
test('pushHistory does not mutate prior snapshots', () => {
  const prior = [createDocument()]
  const next = pushHistory(prior, createDocument())
  assert.equal(prior.length, 1)
  assert.equal(next.length, 2)
})
```

- [ ] **Step 2: Implement IndexedDB adapter**

Use database `mindskit-readme-builder`, version 1, and a `drafts` object store keyed by document ID. Store document plus `updatedAt`; sort summaries newest first. Wrap request/transaction errors as `Error('Local draft storage is unavailable in this browser.')`. Do not install an IndexedDB test dependency; test adapter behavior manually in Task 4.

- [ ] **Step 3: Run and commit**

Run: `node --test tests/readme-builder.test.ts`

Expected: PASS.

```bash
git add src/features/readme-builder/drafts.ts tests/readme-builder.test.ts
git commit -m "feat(readme-builder): add local draft persistence"
```

### Task 4: Compose the responsive workspace and connect browser actions

**Files:**
- Create: `src/pages/readme-builder-page.tsx`
- Modify: `src/config/tools.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes every public interface from Tasks 1–3.
- Produces `ReadmeBuilderPage` at `/text-tools/readme-builder`.

- [ ] **Step 1: Register the tool and route**

```tsx
// config/tools.ts
{ id: 'readme-builder', name: 'README Builder', description: 'Build, preview, and save clean README.md files locally.', category: 'text-tools', path: '/text-tools/readme-builder', icon: BookOpen }

// App.tsx
<Route path="/text-tools/readme-builder" element={<ReadmeBuilderPage />} />
```

- [ ] **Step 2: Implement document selection and responsive view state**

```tsx
const [document, setDocument] = useState(() => createDocument())
const [selectedSectionId, setSelectedSectionId] = useState<string | null>(document.sections[0]?.id ?? null)
const [view, setView] = useState<'builder' | 'markdown' | 'preview'>('builder')
const markdown = useMemo(() => renderReadme(document), [document])
```

Use `ToolPageHeader`, `Button`, `CodeEditor`, `CopyButton`, `ToolStatus`, and semantic theme classes. Desktop is a three-column Sections/Editor/Preview grid at `lg`; smaller screens use Builder/Markdown/Preview tabs.

- [ ] **Step 3: Implement all section editing operations**

Render the library picker, selected-section field editor, Custom Section title/body, hide, remove, duplicate, native drag/drop, and Move up/down controls. Use button labels such as `Move Features up`; native DnD is enhancement only. After removal select the prior section, otherwise the next one. Every document mutation is one history snapshot; cap undo/redo at 50.

- [ ] **Step 4: Implement raw Markdown, preview, badges, TOC, and validation**

Use an editable CodeMirror buffer initialized from rendered Markdown. **Apply Markdown** calls `importReadme`, displays notices, and adds one history entry. Preview with `<ReactMarkdown>{markdown}</ReactMarkdown>` and existing `markdown-preview` styling. Add badge label/message/color/link controls, TOC toggle, and validation output in `ToolStatus`.

- [ ] **Step 5: Implement import/export and drafts**

Use a hidden file input accepting `.md,.markdown,.txt`, reject files over 10 MiB before reading, and a pasted-Markdown dialog. Provide Copy Markdown and:

```ts
const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
link.download = 'README.md'
link.click()
window.setTimeout(() => URL.revokeObjectURL(url), 1000)
```

Provide save/load/rename/duplicate/delete drafts. After an explicit successful save, auto-save changed documents after 600 ms. Catch IndexedDB errors into status state without touching the in-memory document. Confirm template replacement on meaningful documents, New/Reset, and delete.

- [ ] **Step 6: Manual browser verification**

Run: `pnpm dev`

Expected: verify all templates; all 19 section types; custom sections; DnD and buttons; hide/remove/duplicate; raw and file/paste import; unknown Markdown fallback; badge/TOC; undo/redo; copy/download; save/autosave/reload/rename/delete drafts; confirmations; mobile tabs; six themes and system mode.

- [ ] **Step 7: Commit**

```bash
git add src/pages/readme-builder-page.tsx src/config/tools.ts src/App.tsx
git commit -m "feat(readme-builder): add responsive README authoring workspace"
```

### Task 5: Document and fully verify the feature

**Files:**
- Modify: `README.md`
- Modify: `CONTEXT.md`
- Modify: `tests/readme-builder.test.ts`

**Interfaces:**
- Consumes final behavior from Tasks 1–4.
- Produces user-facing documentation and complete regression coverage.

- [ ] **Step 1: Add final regression tests**

```ts
test('hidden and empty custom sections generate no empty headings', () => {
  assert.doesNotMatch(renderReadme(documentWithHiddenAndEmptyCustomSections()), /## Hidden|## Custom Section/)
})

test('badge URLs encode unsafe label/message characters', () => {
  assert.match(createBadgeUrl({ label: 'build status', message: 'passing/green', color: 'bright green' }), /build%20status/)
})
```

- [ ] **Step 2: Update documentation**

Add README Builder to `README.md` with templates, GitHub-style preview, import/export, and browser-only local drafts. Update `CONTEXT.md` with the route, all feature behavior, IndexedDB independence from Remember input, and required browser checks.

- [ ] **Step 3: Run automated checks**

Run: `pnpm lint && pnpm test:sql && pnpm build`

Expected: all commands exit 0; `test:sql` discovers the new file through `tests/*.test.ts`.

- [ ] **Step 4: Verify the production bundle**

Run: `pnpm preview`

Expected: repeat import, download, saved-draft restore, mobile tabs, keyboard reorder, and theme switching. Record any browser check that cannot be exercised.

- [ ] **Step 5: Commit**

```bash
git add README.md CONTEXT.md tests/readme-builder.test.ts
git commit -m "docs(readme-builder): document local README authoring"
```

## Self-review

- Scope coverage: Tasks 1–5 cover templates, section library, add/remove/reorder, structured editor, Markdown/preview, copy/download, drafts, import, custom sections, badges, TOC, autosave, reset/new, duplicate/visibility, undo/redo, and validation.
- The Markdown module is the sole rendering/import seam, keeping UI shallow and pure behavior testable.
- Review Focus is assigned: import/anchors to Task 2, storage error to Task 3/4, reorder and confirmation to Task 4.
- No product code or dependencies are part of this planning change.

