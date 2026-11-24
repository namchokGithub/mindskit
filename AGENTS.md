# MindsKit contributor guide

MindsKit is a static, browser-only developer toolbox. Keep all pasted data,
file processing, generation, and transformations on the client: do not add a
backend, database, authentication service, analytics endpoint, or third-party
content-processing API without an explicit product decision.

`CONTEXT.md` is the detailed continuation reference. Source code is the
authority when it disagrees with `README.md`, `CONTEXT.md`, or anything under
`docs/plan/`, `docs/superpowers/plans/`, or `docs/issues/` (historical plans
and issue notes, not current specifications).

## Communication

Reply in the language the user writes in. Write code, comments, commit
messages, and repository documentation in English.

## Commands

```bash
pnpm install
pnpm dev             # Vite development server (opens a browser)
pnpm lint            # Oxlint
pnpm build           # fetches background-removal assets (network), type-checks, builds dist/
pnpm test:sql        # all unit tests: node --test tests/*.test.ts (not only SQL)
pnpm preview         # serves the production build
pnpm data:minecraft  # regenerates bundled Minecraft data
```

Use `pnpm@11.24.0` as pinned by `packageManager` in `package.json` (via
Corepack). TypeScript is strict; unused locals and parameters are build errors.
`pnpm build` downloads assets and fails offline or in a network-restricted
sandbox.

## Project map

- `src/main.tsx`: provider setup and browser-router entry point.
- `src/App.tsx`: explicit bindings from implemented paths to pages. Lazy-load
  large client-only features when appropriate.
- `src/config/tools.ts`: categories and tool metadata used by home, navigation,
  search, and Quick Actions.
- `src/pages/`: UI composition and tool state. Prefer feature logic outside a
  page when it is reusable or deserves direct tests.
- `src/features/`: client-side processing logic. Browser APIs such as Web
  Crypto and `DOMParser` require a browser-capable test environment.
- `src/components/tool/`: shared tool UI; `CodeEditor` is CodeMirror, not a
  textarea. Reuse the shared page/control components where they fit.
- `src/components/layout/`: application shell, navigation, theming controls,
  and Quick Actions.
- `src/hooks/`: persistence, theme, copy, and large-input behavior.
- `src/index.css`, `src/config/themes.ts`, `public/theme-init.js`: theme
  tokens and initialization. Keep theme IDs/defaults synchronized.
- `public/_headers` and `public/_redirects`: host-level security policy and
  SPA fallback. Review CSP before introducing a new runtime resource.
- `tests/`: Node test runner unit tests for non-visual logic (SQL, JSON, JWT,
  images, CSP compatibility, tool catalog, and more).
- `docs/ui-patterns.md`, `docs/animation.md`: current UI and motion rules.

Imports may use the `@/` alias for `src/`.

## Adding or changing a tool

1. Implement or adjust processing in the relevant `src/features/` module and
   compose the interface in `src/pages/`.
2. Update `src/config/tools.ts` **and** the implemented route in `src/App.tsx`.
   A catalog entry alone only supplies navigation metadata; it does not create
   a route. Keep ID, path, title, description, and category aligned.
3. Reuse the established UI patterns (`ToolPageHeader`, `CodeEditor`, copy and
   status controls, formatter/text-transform pages) before creating new ones.
4. If input persistence is appropriate, use a unique key through the opt-in
   persistence hooks. Consider large-input confirmation for costly work.
5. Follow the testing and verification rules below.
6. Update `CONTEXT.md` and `README.md` for user-visible behavior changes.

Routes and categories are intentionally not a one-to-one URL model: preserve
existing legacy paths unless the change explicitly migrates them.

## Privacy, security, and persistence

- Treat browser-local processing as a product guarantee. Do not transmit user
  content or execute generated SQL.
- **Remember input** is opt-in and off by default. Stored inputs use
  `mindskit:input:<key>` only while it is enabled; disabling it is not a global
  purge of every historical key.
- Never persist JWT tokens/secrets or generated passwords. Keep those values
  in component memory, as the existing tools do.
- Image handoffs between image tools are in-memory PNGs. Do not write handed-off
  images to `localStorage`, IndexedDB, or other persistent storage.
- JWT decoding does not prove authenticity. SQL Parameters Preview is for
  local debugging and must not be described as safe query substitution.
- Preserve dialect-aware SQL escaping and validation; do not replace it with
  naive string concatenation.
- Maintain the CSP-compatible, same-origin resource model in `public/_headers`.
  The build's background-removal asset fetch is intentional; do not add
  unrelated network behavior.
- The CSP forbids `eval` and `new Function`. Do not add dependencies or code
  that rely on them; patch or replace such code (see the bundled `ndarray`
  patch) and keep `tests/csp-compat.test.ts` passing.

## UI and styling guardrails

- Preserve accessibility and Radix/shadcn patterns already used by the app.
- Use semantic theme tokens rather than hard-coded palette values. Verify all
  six named themes (`pearl-light`, `mint-frost`, `amber-dawn`,
  `midnight-violet`, `aurora-blue`, `cyber-rose`) and system mode when
  changing shared layout or colors.
- `AppShell` deliberately forms a stacking context so the fixed decorative
  `src/assets/bg.png` remains behind content. Keep the asset decorative,
  bottom-aligned, and legible rather than turning it into a viewport cover.
- Follow `docs/ui-patterns.md` for tool page structure: `ToolPage`,
  `ToolPageHeader`, one of the four workspace layouts in
  `src/components/tool/workspace.tsx`, one primary button per toolbar, and
  `EmptyState` / output panes.
- Follow `docs/animation.md` for any animation: keep it opt-in per feature,
  use `MotionProvider`/`m.*` and the presets in `src/lib/motion.ts`, never
  stack Motion `layout` or AutoAnimate on `@dnd-kit` sortable items, and
  always provide a reduced-motion fallback.
- Preserve the 10 MiB `CodeEditor` import limit and language-specific file
  filtering unless a tool has an explicit reason to change them.

## Testing and verification

- **Writing tests:** Add automated tests for domain, application, repository,
  persistence, security-rule, migration, and other non-visual logic. Do not
  create or update automated tests for UI-only work (visual styling, layout,
  presentation components, or page appearance). Change a UI test only when the
  user asks or a UI change also changes non-visual behavior.
- **Running checks:** You may run only the test files you added or changed,
  for example `node --test tests/<name>.test.ts`. Do not run `pnpm lint`,
  `pnpm build`, `pnpm test:sql` (the full suite), or other build commands
  unless the user explicitly requests it.
- **Browser:** The user verifies browser flows, mobile navigation, and
  light/dark themes manually. Start the dev server or use browser automation
  only when the user asks for it.
- Report which checks were and were not run. Do not claim a browser-only flow
  (editors, downloads, clipboard, persistence, responsive navigation, themes)
  is verified without exercising it in a browser.

## Decisions

Ask the user before deciding anything that affects:

- scope (adding, removing, or deferring requested work);
- user-visible behavior, UX, copy, or tool naming;
- data formats, persistence keys, routes, or tool IDs;
- new dependencies or runtime resources;
- privacy, security, or CSP.

For implementation details inside those boundaries (internal names, file
layout, helper structure), follow existing patterns in the codebase without
asking.

## Git and releases

- Do not create commits or tags unless the user explicitly requests it.
- Never run `git push` (branches, tags, or `--force`) or create a GitHub
  Release. Prepare the commit or tag locally, then hand the user the exact
  push/release command to run.
- Never add AI/agent attribution to commits, tags, pull requests, or release
  notes (for example `Co-Authored-By: Claude …` or "Generated with …"). GitHub
  counts co-author trailers as repository contributors, and a pushed trailer
  cannot be removed without rewriting history.

## After code changes

Report:

- what changed and the important files touched;
- which checks were and were not run;
- remaining concerns or follow-up work;
- a suggested commit message.

Commit message rules:

1. Base it on staged changes (`git diff --cached`) if any exist; otherwise on
   `git diff`. Never mix the two.
2. Use Conventional Commits: `<type>(<scope>): <summary>`, with a scope when
   one is identifiable (for example `sql`, `images`, `remove-background`).
3. Include Jira keys after the scope if they appear in the diff.
4. Keep the subject at 100 characters or fewer and focus on user or business
   impact, not syntax noise. Ignore whitespace-only changes.

Example:

```
fix(remove-background): reset mounted flag on mount so results are not dropped under StrictMode
```
