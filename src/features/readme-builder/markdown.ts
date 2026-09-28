import type { ReadmeBadge, ReadmeDocument, ReadmeSection, SectionKind } from './model.ts'

/**
 * A single entry in a rendered table of contents
 */
export interface TocEntry {
  title: string
  href: string
}

/**
 * Result of importing Markdown into a structured document
 */
export interface ImportResult {
  document: ReadmeDocument
  notices: string[]
}

/**
 * Default titles for the library section kinds recognized on import.
 * Mirrors the `defaultTitle` values of `SECTION_LIBRARY` in `model.ts` (not
 * exported there); keep these in sync if a library title changes.
 */
const LIBRARY_SECTION_TITLES: Array<[Exclude<SectionKind, 'custom' | 'divider'>, string]> = [
  ['overview', 'Overview'],
  ['live-demo', 'Live Demo'],
  ['screenshots', 'Screenshots'],
  ['features', 'Features'],
  ['tech-stack', 'Tech Stack'],
  ['requirements', 'Requirements'],
  ['installation', 'Installation'],
  ['usage', 'Usage'],
  ['configuration', 'Configuration'],
  ['scripts', 'Scripts'],
  ['project-structure', 'Project Structure'],
  ['api-reference', 'API Reference'],
  ['testing', 'Testing'],
  ['deployment', 'Deployment'],
  ['roadmap', 'Roadmap'],
  ['contributing', 'Contributing'],
  ['license', 'License'],
  ['acknowledgements', 'Acknowledgements'],
]

/**
 * Escape Markdown-significant bracket characters in text used as image alt
 * text, so a label containing `[`/`]` can't prematurely close the `![...]`
 * span it's embedded in.
 */
function escapeMarkdownLabel(value: string): string {
  return value.replace(/\[/g, '\\[').replace(/\]/g, '\\]')
}

/**
 * Escape parentheses for safe use inside a Markdown `(url)` link
 * destination. `encodeURIComponent` (used by `createBadgeUrl`) intentionally
 * leaves `(` and `)` unescaped, and a badge's `link` field is plain
 * user-entered text with no encoding at all, so either can carry a literal
 * `(`/`)` into the URL. An unescaped `)` there closes the destination early
 * and breaks the surrounding `[...](url)`/`![...](url)` syntax, so both are
 * percent-encoded here — equivalent for the browser, safe for Markdown.
 */
function escapeMarkdownUrl(url: string): string {
  return url.replace(/\(/g, '%28').replace(/\)/g, '%29')
}

/**
 * Build the Shields.io badge image URL for a badge
 */
export function createBadgeUrl(badge: ReadmeBadge): string {
  const label = encodeURIComponent(badge.label)
  const message = encodeURIComponent(badge.message)
  const color = encodeURIComponent(badge.color)
  return `https://img.shields.io/badge/${label}-${message}-${color}`
}

/**
 * Render a single badge as a standard Markdown image, wrapped in a Markdown
 * link only when linked. Plain `react-markdown` (this app has no
 * `rehype-raw`) renders this as an actual image; raw HTML `<img>`/`<a>` tags
 * would render as literal escaped text instead.
 */
function renderBadgeMarkup(badge: ReadmeBadge): string {
  const url = escapeMarkdownUrl(createBadgeUrl(badge))
  const alt = escapeMarkdownLabel(badge.label)
  const image = `![${alt}](${url})`
  if (badge.link && badge.link.trim() !== '') {
    return `[${image}](${escapeMarkdownUrl(badge.link)})`
  }
  return image
}

/**
 * Resolve the Markdown heading text for a section: a custom title when set,
 * otherwise the section's own title.
 */
function getSectionHeading(section: ReadmeSection): string {
  if (section.kind === 'custom' && section.fields.customTitle && section.fields.customTitle.trim() !== '') {
    return section.fields.customTitle
  }
  return section.title
}

/**
 * Lowercase ASCII slug: collapse non-alphanumeric runs to `-`, trim ends
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Build table-of-contents entries for visible sections, excluding Overview,
 * in document order. Sections that render no `##` block (see
 * `sectionRenderedParts`) are skipped too, so the TOC never links to a
 * heading that never appears and never consumes a slug-collision suffix
 * meant for a section that does render. Duplicate slugs among the
 * sections that do render get `-1`, `-2`, ... suffixes in order of
 * appearance.
 */
export function createTocEntries(document: ReadmeDocument): TocEntry[] {
  const seenSlugCounts = new Map<string, number>()
  const entries: TocEntry[] = []
  for (const section of document.sections) {
    if (!section.visible || section.kind === 'overview' || section.kind === 'divider') continue
    if (sectionRenderedParts(section).length === 0) continue
    const title = getSectionHeading(section)
    const baseSlug = slugify(title)
    const count = seenSlugCounts.get(baseSlug) ?? 0
    seenSlugCounts.set(baseSlug, count + 1)
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`
    entries.push({ title, href: `#${slug}` })
  }
  return entries
}

/**
 * Render a section's field-derived content, excluding the title field
 */
function renderFieldContent(section: ReadmeSection): string {
  const lines: string[] = []
  for (const [name, value] of Object.entries(section.fields)) {
    if (name === 'customTitle') continue
    const trimmed = value.trim()
    if (trimmed === '') continue
    // The only other library field today is `url` (Live Demo); render it as
    // a Markdown autolink. Any future plain-text field falls back to itself.
    lines.push(name === 'url' ? `<${trimmed}>` : trimmed)
  }
  return lines.join('\n\n')
}

/**
 * The non-empty content pieces a section would render: its field-derived
 * content and its trimmed body, in that order, with empty pieces dropped.
 * An empty result means the section renders no `##` block at all. Shared by
 * `renderSectionBlock` and `createTocEntries` so both agree on what "empty"
 * means — a section skipped by one must be skipped by the other.
 */
function sectionRenderedParts(section: ReadmeSection): string[] {
  const fieldContent = renderFieldContent(section)
  const body = (section.body ?? '').trim()
  return [fieldContent, body].filter((part) => part !== '')
}

/**
 * Render one visible section as a `##` block, or null when it has no content
 */
function renderSectionBlock(section: ReadmeSection): string | null {
  if (section.kind === 'divider') return '---'
  const parts = sectionRenderedParts(section)
  if (parts.length === 0) return null
  return `## ${getSectionHeading(section)}\n\n${parts.join('\n\n')}`
}

/**
 * Render a document to Markdown: H1, optional badges, optional TOC, then
 * visible sections in exact document order. Empty sections (no field-derived
 * content and no body) are omitted entirely.
 */
export function renderReadme(document: ReadmeDocument): string {
  const parts: string[] = [`# ${document.title}`]

  if (document.badges.length > 0) {
    parts.push(document.badges.map(renderBadgeMarkup).join(' '))
  }

  if (document.includeTableOfContents) {
    const entries = createTocEntries(document)
    if (entries.length > 0) {
      const tocLines = entries.map((entry) => `- [${entry.title}](${entry.href})`).join('\n')
      parts.push(`## Table of Contents\n\n${tocLines}`)
    }
  }

  for (const section of document.sections) {
    if (!section.visible) continue
    const block = renderSectionBlock(section)
    if (block) parts.push(block)
  }

  return `${parts.join('\n\n')}\n`
}

/**
 * A top-level (`##`) block found while scanning Markdown for import
 */
interface ParsedBlock {
  heading: string
  lines: string[]
}

/**
 * Split lines into leading preamble text and top-level `##` blocks. A line
 * is only treated as a heading outside fenced code regions (``` or ~~~).
 */
function parseTopLevelBlocks(lines: string[]): { preamble: string[]; blocks: ParsedBlock[] } {
  const preamble: string[] = []
  const blocks: ParsedBlock[] = []
  let current: ParsedBlock | null = null
  let inFence = false

  for (const line of lines) {
    const isFenceDelimiter = /^(`{3,}|~{3,})/.test(line.trim())
    const isTopLevelHeading = !inFence && !isFenceDelimiter && /^##\s+\S/.test(line)

    if (isTopLevelHeading) {
      if (current) blocks.push(current)
      current = { heading: line.replace(/^##\s+/, '').trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    } else {
      preamble.push(line)
    }

    if (isFenceDelimiter) inFence = !inFence
  }
  if (current) blocks.push(current)

  return { preamble, blocks }
}

/**
 * Find the library section kind whose default title matches a heading
 */
function matchLibraryKind(heading: string): [Exclude<SectionKind, 'custom'>, string] | null {
  const normalized = heading.trim().toLowerCase()
  return LIBRARY_SECTION_TITLES.find(([, title]) => title.toLowerCase() === normalized) ?? null
}

/**
 * Conservatively import Markdown into a structured document.
 *
 * Only an initial H1 and top-level H2 blocks whose heading matches a known
 * library section title are recognized. Everything else — unknown headings,
 * tables, raw HTML, fenced code, and any content found before the first
 * recognized section — is preserved verbatim inside a Custom Section body.
 * Nothing is discarded; every fallback is reported in `notices`. This is
 * deliberately not a full Markdown-to-model conversion.
 */
export function importReadme(markdown: string): ImportResult {
  const notices: string[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')

  let index = 0
  while (index < lines.length && lines[index].trim() === '') index++
  const h1Match = index < lines.length ? /^#\s+(.+)$/.exec(lines[index]) : null

  let title: string | null = null
  let bodyLines = lines
  if (h1Match) {
    title = h1Match[1].trim()
    bodyLines = lines.slice(index + 1)
  } else {
    notices.push('No top-level heading found; using a default document title.')
  }

  const { preamble, blocks } = parseTopLevelBlocks(bodyLines)
  const sections: ReadmeSection[] = []

  const preambleText = preamble.join('\n').trim()
  if (preambleText !== '') {
    sections.push({
      id: crypto.randomUUID(),
      kind: 'custom',
      title: 'Custom Section',
      visible: true,
      fields: { customTitle: 'Imported Content' },
      body: preambleText,
    })
    notices.push('Preserved content before the first recognized section as a custom section.')
  }

  for (const block of blocks) {
    const blockText = block.lines.join('\n').trim()
    const matched = matchLibraryKind(block.heading)
    if (matched) {
      const [kind, defaultTitle] = matched
      sections.push({
        id: crypto.randomUUID(),
        kind,
        title: defaultTitle,
        visible: true,
        fields: {},
        body: blockText,
      })
    } else {
      sections.push({
        id: crypto.randomUUID(),
        kind: 'custom',
        title: 'Custom Section',
        visible: true,
        fields: { customTitle: block.heading },
        body: blockText,
      })
      notices.push(`Unrecognized section "${block.heading}" imported as a custom section.`)
    }
  }

  const document: ReadmeDocument = {
    version: 1,
    id: crypto.randomUUID(),
    name: 'Imported README',
    title: title ?? 'Untitled README',
    projectType: 'blank',
    includeTableOfContents: false,
    badges: [],
    sections,
  }

  return { document, notices }
}
