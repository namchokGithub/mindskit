# MindsKit — Context for AI/Developer Continuation

Last checked against source: 2026-09-06.

## Product and Boundaries

- **Name:** MindsKit (`mindskit` package, version 0.2.0).
- **Goal:** A lightweight, expandable developer toolbox that runs in the browser.
- Keep tools simple and focused; process pasted content locally without sending it to a server or third-party API.
- Static SPA only: no backend, database, authentication service, Firebase, or Cloudflare Workers.
- Treat the source code as the authority for implemented behavior. `README.md` and historical plans in `docs/plan/` may lag behind it; for example, the README still describes JWT as decoding-only.

## Tech Stack

- React 19, TypeScript 6 (strict), Vite 8, pnpm.
- Tailwind CSS v4, shadcn/ui (Radix), lucide-react, react-icons, React Router, sonner; Oxlint for linting.
- CodeMirror 6 through `@uiw/react-codemirror` for editors; `vanilla-jsoneditor` for JSON tree previews; `react-markdown` for Markdown previews.
- `sql-formatter` (dynamically loaded on formatting), `qrcode`, `jsbarcode`, and `yaml` for client-side generation/conversion.
- Browser APIs include `DOMParser` / `XMLSerializer`, Web Crypto, File/Blob, clipboard, and `Intl` for date/timezone handling.
- `@/*` resolves to `src/*`; see `tsconfig.app.json` and `vite.config.ts`.

## Architecture

- **Entry point:** `src/main.tsx` wraps the app in `StrictMode`, `ThemeProvider`, `SaveLocallyProvider`, and `BrowserRouter`.
- **Tool catalog:** `src/config/tools.ts` defines categories and tool metadata (id, name, description, category, path, icon, optional `comingSoon`); types live in `src/types/tool.ts`. Navigation, home, search, and category labels use this catalog.
- **Routing:** `src/App.tsx` explicitly maps implemented paths to page components. Only `comingSoon` routes are generated from the catalog. Page titles/descriptions are also passed locally in several pages, so metadata is not fully centralized; keep these definitions consistent when changing tools.
- **Layout:** `src/components/layout/app-shell.tsx` provides shared navigation, a collapsible desktop sidebar, mobile Sheet navigation, theme selection, Quick Actions, footer, and an `Outlet`. Quick Actions supports search, pinned tools, recent tools, and usage counts. The app shell is an isolated stacking context so decorative background layers remain behind the interface instead of falling behind the page body.
- **Pages:** `src/pages/*` compose controls, state, and feature functions. Some related tools share page files or configurable page components.
- **Feature logic:** `src/features/formatters/*` handles JSON/XML formatting and validation. Other modules under `src/features/` cover text, SQL IN clauses, JWT, password generation, quick tools, JSON conversions/type generation, and value/date conversions. Keep reusable processing separate from UI where practical; some tool-specific logic currently remains in pages.
- **Results:** Formatter functions use `FormatResult` / `ValidateResult` from `src/types/format.ts`, with error messages and optional line/column positions. Other feature modules have their own return types or throw errors handled by pages; there is no single result contract for all tools.
- **Processing:** JSON uses native parsing/stringification; XML uses browser DOM APIs and a recursive pretty-printer. JWT signing/verification uses Web Crypto. These browser-dependent functions need a browser-capable environment when tested.

## Shared Tool UI

- `CodeEditor` is a CodeMirror editor, not a textarea. It provides language highlighting, line numbers, folding, wrapping, read-only output, error-line highlighting, font sizes from 11–20 px, and local file import. JSON, XML, Markdown, TypeScript, and SQL use language extensions; Go uses custom token decorations.
- File import checks extensions according to the editor language and rejects files larger than 10 MiB (`MAX_IMPORT_SIZE` in `src/components/tool/code-editor.tsx`). Accepting an extension does not imply that every tool understands that file format.
- `FormatterPage` supplies shared input/output controls for JSON Formatter and Minifier, including configurable code/form/text/tree output views. `JsonTreePreview` dynamically loads `vanilla-jsoneditor`; `JsonFormPreview` supplies a separate form-style preview.
- `TextTransformPage` supplies reusable text transformations and controls. Dedicated pages handle different interactions, including XML format/minify/validate and the single-input JSON Validator.
- Other shared pieces include `CopyButton`, `IndentSelect`, `ToolStatus`, `ToolPageHeader`, and `TextStats`.
- `useLargeInputConfirmation` and `LargeInputDialog` request confirmation before running an action on input larger than 5 MiB by default. This applies only where the hook is used, is configurable, and is not a universal hard input limit or background-processing mechanism.

## Current Scope

There are 50 registered tools in eight categories. Exact paths and metadata live in `src/config/tools.ts`; implemented route bindings live in `src/App.tsx`.

| Category | Tools |
| --- | --- |
| SQL (`sql`) | SQL Formatter, SQL Minifier, SQL Parameters Preview, CREATE TABLE → Types, SQL Syntax Checker, SQL IN Builder, JSON / CSV → INSERT |
| JSON (`json`) | Formatter, Minifier, Validator, Stringify/Parse, Sorter, Compare, Data Generator |
| XML (`xml`) | Formatter, Minify, Viewer, Validator, WSDL Formatter, SOAP Formatter |
| Text Tools (`text-tools`) | Remove Spaces, Make One Line, Text Decoration, Markdown, Split Text, Join Text, README Builder |
| Encode / Decode (`encode-decode`) | Base64, URL, HTML, JWT Encoder / Decoder |
| Generators (`generators`) | UUID, QR Code, Barcode, Random String, Strong Password Generator |
| Converters (`converters`) | JSON → YAML, JSON → CSV, Unix Timestamp, JSON → Go Struct, JSON → TypeScript, JSON ↔ XML, Number Base, Letters ↔ Numbers, Color, Date Formatter, Roman Numeral Date |
| Images (`images`) | Image Resize, Image Crop, Remove Background |

- JSON routes retain `/formatters/...`; XML tools use both `/formatters/xml` and `/xml/...`. Category IDs do not necessarily match URL prefixes.
- XML Minify, WSDL Formatter, and SOAP Formatter reuse `XmlFormatterPage` with distinct metadata/storage keys. WSDL/SOAP validation is XML syntax validation, not schema or protocol validation.
- JWT supports header/payload inspection, expiry status, and optional HMAC signature verification, plus creation of signed tokens using HS256/HS384/HS512. Decoding alone does not verify authenticity. Implementation lives in `src/features/jwt.ts` and `src/pages/jwt-decoder-page.tsx`.
- Strong Password Generator supports Random, Memorable, and PIN modes, with cryptographically secure randomness and strength/entropy feedback.
- QR codes support PNG download; barcodes support SVG download. JSON → YAML/CSV supports output downloads. Markdown includes a rendered preview.
- JSON Data Generator (`/json/generator`) builds flat JSON object arrays from a local field schema: UUID, running ID, fictional name/email, boolean, integer, decimal, date/time, text, or enum. It supports nullable and unique fields, 1–1000 records, indentation, copy/download, and a one-time `sessionStorage` transfer to SQL INSERT. Generated values use Web Crypto; no generated data is sent to a server.
- README Builder (`/text-tools/readme-builder`) builds a document from templates and a 20-entry section library, including a Divider that renders `---` without a heading or table-of-contents entry, with Shields.io badges and an optional table of contents, rendered to Markdown by the sole render/import seam in `src/features/readme-builder/markdown.ts`. The workspace is three-column (sections, editor, live preview) on desktop and tab-switched (Builder/Markdown/Preview) on narrow screens. Markdown import is conservative: only an initial H1 and H2 headings matching a known library title are recognized; everything else is preserved verbatim in a custom section. Undo/redo history caps at 50 snapshots, and drafts autosave to IndexedDB via `src/features/readme-builder/drafts.ts`.
- SQL pages share `src/pages/sql-tools-pages.tsx`, `src/pages/sql-advanced-pages.tsx`, and processing in `src/features/sql.ts`. Formatter uses `/sql/formatter`; Minifier uses `/sql/minify`; Parameters Preview uses `/sql/parameters`; CREATE TABLE → Types uses `/sql/create-table-types`; Syntax Checker uses `/sql/syntax-checker`; INSERT uses `/sql/insert`; IN Builder retains `/formatters/sql-in` and the `sql-in-clause` tool ID/storage key. The old Special Tools category is replaced by SQL.
- SQL tools support PostgreSQL, MySQL, and SQL Server. IN Builder accepts raw text/UUIDs or numeric literals with explicit line, CSV, or whitespace separators, deduplication, and IN/NOT IN. INSERT accepts flat JSON object arrays or CSV with unique headers; missing JSON fields become NULL, CSV stays text, and empty CSV fields optionally become NULL. Batch size is 1–1000. Unsupported nested values and unsafe JSON integers are rejected. SQL is generated locally, never executed.
- SQL identifiers and values are escaped per dialect. PostgreSQL backslashes use E-strings; SQL Server uses Unicode N-strings; MySQL uses utf8mb4 literals and hexadecimal conversion for backslash-containing text to avoid SQL-mode ambiguity. Outputs can be copied or downloaded as `.sql` files.
- Image Resize (`/images/resize`) accepts one PNG, JPEG, or WebP image of up to 20 MiB and 10,000 px per side. It exports a list of up to 10 pixel or percentage sizes sequentially, limiting peak processing memory; each result has its own download. PNG preserves transparency; JPEG output uses a white background because JPEG has no alpha channel. Output dimensions are limited to 10,000 px per side.
- Parameters Preview accepts JSON arrays for `?`/`$1` and JSON objects for `:name`, skips placeholders inside SQL strings, quoted identifiers, and comments, and exists only for local debugging; it must not be presented as safe substitution for query execution. CREATE TABLE → Types handles one CREATE TABLE statement and common scalar columns; it does not model all dialect-specific DDL. Syntax Checker uses `sql-formatter` parsing for the selected dialect and cannot validate database schema, permissions, or extensions.
- Additional routes: home `/`, privacy `/privacy`, and license `/license`.

## Persistence and Privacy

- The global **Remember input** preference is opt-in and off by default. `useSaveLocally` stores the preference under `mindskit:save-input-locally`.
- Pages using `usePersistedInput` store input under `mindskit:input:<key>` only when enabled. Empty input or disabling persistence removes the mounted hook's key. This is not a global purge of every saved tool input.
- JWT token/secret state and Strong Password Generator output stay in component memory, with Remember input hidden. The JWT decoder also removes its legacy `mindskit:input:jwt-decoder` key on mount. Do not introduce persistence for these sensitive values.
- Theme preference (`mindskit:theme`) and Quick Actions metadata (`mindskit:quick-actions`: favorites, recent tool IDs, usage counts) persist independently of Remember input. Quick Actions does not store pasted content.
- README Builder drafts persist independently of Remember input too: `src/features/readme-builder/drafts.ts` autosaves the document to a dedicated IndexedDB database, not the `mindskit:input:<key>` mechanism, so drafts remain saved regardless of the Remember input setting.
- The processing paths are client-side; local file import reads files in the browser. Preserve this boundary when adding tools or dependencies.

## Theming

- `src/config/themes.ts` defines six themes plus the `system` preference:
  - Light: Pearl Light, Mint Frost, Amber Dawn.
  - Dark: Midnight Violet, Aurora Blue, Cyber Rose.
- System mode follows `prefers-color-scheme`, resolving to Pearl Light or Midnight Violet.
- `src/hooks/use-theme.tsx` applies `data-theme` and the `dark` class to `<html>` and persists the preference. CSS tokens in `src/index.css` control theme colors; the palette is no longer a single violet accent.
- `index.html` loads the external `public/theme-init.js` script before React mounts to reduce theme flash. Keep its theme IDs/defaults synchronized with `src/config/themes.ts` when changing themes.
- CodeMirror and sonner use the resolved light/dark mode.
- `src/assets/bg.png` is transparent decorative artwork rendered by `AppShell` as a fixed, bottom-aligned, non-repeating layer. It uses `bg-contain`, scales to at most `56vw` / `58rem` height, and is kept at 70% opacity so page content stays legible. Keep it behind content and avoid applying it as a full-viewport `cover` image.

## Development and Validation

```bash
pnpm install
pnpm dev       # Vite development server, opens the browser
pnpm lint      # Oxlint
pnpm build     # TypeScript project build followed by Vite production build
pnpm preview   # Preview the production build
pnpm test:sql  # SQL and JSON generator regression tests (Node.js 22.18+ or 24+)
```

- Use a Node.js version compatible with the installed Vite/package versions.
- `tests/sql.test.ts` and `tests/json-data-generator.test.ts` use the Node test runner for SQL behavior plus generator schemas, constraints, and unique-value failures. `tests/readme-builder.test.ts` similarly covers the README Builder document model, Markdown render/import, and drafts. Other tools do not yet have a dedicated automated suite. Lint/build and feature tests do not replace browser checks for tool behavior, storage, file import/download, clipboard, navigation, and responsive/theme behavior.

### Adding or Changing a Tool

1. Add or update processing logic in the relevant `src/features/` module and compose a page in `src/pages/`, reusing shared tool UI where suitable.
2. Add/update the catalog entry in `src/config/tools.ts` and the implemented route in `src/App.tsx`; keep path, title, description, and category consistent. A catalog entry alone does not create an implemented route.
3. Choose a unique storage key if persistence is appropriate and wire it through the existing opt-in hooks. Keep sensitive token/secret/password data out of persistence.
4. Consider large-input confirmation and handle processing errors in the page. Preserve client-side processing and theme-aware styles.
5. Run relevant lint/build and browser checks, then update this context and the README for user-visible changes.

## Deployment and Security Configuration

- Build output is `dist` (`pnpm build`); deploy as a static SPA to Cloudflare Pages or an equivalent static host.
- `public/_redirects` supplies the SPA routing fallback.
- `public/_headers` configures CSP and security headers, including same-origin scripts/connections, blocked framing, MIME-sniffing protection, referrer policy, and restricted browser permissions. These files require host support; do not assume every static host or local preview applies them.
- `img-src` also allows `https://img.shields.io`, a scoped exception for README Builder badge preview images only, not a general allowance for arbitrary external images.
- Theme initialization uses an external same-origin script compatible with the configured script CSP. Review the header policy when adding runtime resource requirements.
