# MindsKit contributor guide

MindsKit is a static, browser-only developer toolbox. Keep all pasted data,
file processing, generation, and transformations on the client: do not add a
backend, database, authentication service, analytics endpoint, or third-party
content-processing API without an explicit product decision.

`CONTEXT.md` is the detailed continuation reference. Source code is the
authority when it disagrees with `README.md` or historical plans in
`docs/plan/`.

## Commands

```bash
pnpm install
pnpm dev          # Vite development server (opens a browser)
pnpm lint         # Oxlint
pnpm build        # fetches required assets, type-checks, then builds dist/
pnpm test:sql     # Node test runner: tests/*.test.ts
pnpm preview      # serves the production build
```

Use the pnpm version pinned in `package.json`. TypeScript is strict; unused
locals and parameters are build errors. `pnpm test:sql` covers SQL, JSON data
generation, and quick-tool regression cases, but it is not a substitute for
browser testing of editors, downloads, clipboard access, persistence,
responsive navigation, and themes.

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
5. Run the relevant automated checks and manually exercise the browser flow,
   including mobile navigation and both light and dark themes.
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
- JWT decoding does not prove authenticity. SQL Parameters Preview is for
  local debugging and must not be described as safe query substitution.
- Preserve dialect-aware SQL escaping and validation; do not replace it with
  naive string concatenation.
- Maintain the CSP-compatible, same-origin resource model in `public/_headers`.
  The build's background-removal asset fetch is intentional; do not add
  unrelated network behavior.

## UI and styling guardrails

- Preserve accessibility and Radix/shadcn patterns already used by the app.
- Use semantic theme tokens rather than hard-coded palette values. Verify all
  six named themes and system mode when changing shared layout or colors.
- `AppShell` deliberately forms a stacking context so the fixed decorative
  `src/assets/bg.png` remains behind content. Keep the asset decorative,
  bottom-aligned, and legible rather than turning it into a viewport cover.
- Preserve the 10 MiB `CodeEditor` import limit and language-specific file
  filtering unless a tool has an explicit reason to change them.

## Verification expectations

For code changes, run at least `pnpm lint` and `pnpm build`; run
`pnpm test:sql` whenever SQL, JSON generation, or quick-tool behavior changes.
Report checks not run and why. Do not claim a browser-only flow is verified
without exercising it in a browser.

## Git Commit Message

- For clear, small, low-risk changes within the current workspace, implement immediately.
- Do not ask for confirmation for cosmetic UI, copy, or styling changes when the requested scope is explicit.
- Ask first only when scope is ambiguous, an action is destructive or irreversible, adds dependencies, changes external services, or affects data outside the workspace.
- After completing code changes:
  - Summarize what changed.
  - List important files changed.
  - Mention any remaining concerns or follow-up work.
  - Suggest a concise Git commit message based on the actual changes.
  - Use Conventional Commits format when appropriate.
  - Never run `git commit` unless explicitly requested.

```
You are a senior software engineer reviewing git changes.

Your task:
Generate a high-quality commit message based ONLY on the relevant git changes.

Rules:

1. If staged changes exist (git diff --cached), use ONLY staged changes.
2. If no staged changes exist, use the regular git diff.
3. Never mix staged and unstaged changes.
4. Use Conventional Commit format.
5. Include scope if identifiable (e.g., invoice, payment, stock, auth, api).
6. If Jira keys appear in the diff, include them after the scope.
7. Keep subject line concise (<= 100 chars).
8. Focus on business impact, not syntax noise.
9. Ignore whitespace-only or formatting-only changes.

Output format:<type></type>feat(feature_name<scope></scope>): <short summary></short>

Example:
fix(payments): store payment payload as payments array only and keep backward-compatible parsing
```
