# README Builder Design

## Goal

Add a browser-only README Builder for Git repositories. Users assemble an ordered README from structured sections, inspect Markdown and a GitHub-like preview, import/export `README.md`, and save multiple local drafts.

## Product decisions

- Register **README Builder** in Text Tools at `/text-tools/readme-builder`; it is a specialized toolbox feature, not a general document workspace.
- Project types are Default, Blank, Web App, Frontend App, Backend API, CLI Tool, Library / Package, Mobile App, and Full Stack App. `createDocument` takes a required `projectType` argument; there is no ambiguous no-argument call. `createDocument('default')` starts Overview, Features, Tech Stack, Installation, Usage, Deployment, and License. `createDocument('blank')` starts with zero sections.
- The section library includes Overview, Live Demo, Screenshots, Features, Tech Stack, Requirements, Installation, Usage, Configuration / Environment Variables, Scripts, Project Structure, API Reference, Testing, Deployment, Roadmap, Contributing, License, Acknowledgements, and Custom Section. Users explicitly add non-template sections.
- Desktop is a three-column Sections / Editor / Preview workspace. Mobile uses Builder, Markdown, and Preview tabs. The Markdown tab uses an explicit Apply Markdown action, never silently replacing the structured draft while typing.
- The document model is the source of truth. The renderer derives Markdown and preview from it. The importer recognizes an initial H1 and known H2 sections conservatively; unsupported content becomes a Custom Section so it is not discarded.
- Use native HTML drag-and-drop plus Move up/Move down buttons. The buttons provide keyboard and touch access; do not add a drag package.
- Local drafts are versioned IndexedDB records. A draft is created automatically after the first meaningful edit and auto-saved on a short debounce (~600 ms); no explicit Save is required before autosave begins, and no empty draft is created before the user modifies the document. Drafts never leave the browser and are independent of Remember input. New/reset/delete and replacing a populated template need confirmation.
- Badges are document metadata rendered under the H1 through a Shields.io image URL. Badge preview `<img>` tags load `https://img.shields.io` directly in the browser; `public/_headers` allowlists that origin under `img-src` (see Constraints). An opt-in TOC lists visible non-Overview sections using stable ASCII slugs with collision suffixes.
- Undo/redo stores immutable document snapshots, capped at 50. User mutations enter history; selection, tabs, and successful saves do not.

## Deep modules

`src/features/readme-builder/model.ts` is the deep module and external seam for UI and tests. It exports a serializable `ReadmeDocument` plus immutable helpers: `createDocument`, `applyTemplate`, `addSection`, `updateSection`, `duplicateSection`, `moveSection`, and `validateDocument`.

`src/features/readme-builder/markdown.ts` has the small interface `renderReadme(document): string` and `importReadme(markdown): ImportResult`. It hides section-specific Markdown, escaping, badge formatting, TOC slugs, and conservative parsing. The page never builds Markdown itself.

`src/features/readme-builder/drafts.ts` factors IndexedDB access behind an internal `DraftStorage` seam and exposes `listDrafts`, `loadDraft`, `saveDraft`, `renameDraft`, and `deleteDraft`, bound by default to a real IndexedDB-backed storage. `createDraftsAdapter(storage)` builds those same five operations over any `DraftStorage`, so tests substitute an in-memory fake without touching a browser. The page supplies serializable documents and gets typed errors, keeping storage behavior local and pure logic runnable in Node tests.

## Data, rendering, and safety

Each section has an opaque ID, library kind, editable title, visibility, `fields: Record<string, string>`, and a Markdown `body`. The library defines form fields and rendering for each kind. Empty optional fields and empty sections render nothing. Unknown imported text stays as the Custom Section body.

The renderer emits the H1, optional badges, optional TOC, and visible sections in exact order. Custom headings must not be blank or duplicate a visible heading. Preview uses `react-markdown`; raw HTML is never executed.

## Verification

Add pure Node tests for templates, immutable changes, rendering order, hidden/empty sections, escaping, TOC collisions, badges, validation, and conservative import. Manually test native DnD, Move buttons, mobile tabs, file/paste import, download/copy, IndexedDB autosave/restore/failure, confirmation dialogs, six themes, and system mode.

## Constraints

- No backend, analytics, authentication, or third-party content-processing API.
- No new dependencies; use installed CodeMirror, React Markdown, Radix, lucide-react, and browser APIs.
- Badge preview loads images from `https://img.shields.io`; update `public/_headers` `img-src` to allow that origin explicitly. Do not broaden CSP to arbitrary external image domains in v1.
- Preserve the 10 MiB import limit and `.md`, `.markdown`, `.txt` filtering.
- Do not persist secrets or transmit README text.
- Update `README.md` and `CONTEXT.md` when implementation ships.

