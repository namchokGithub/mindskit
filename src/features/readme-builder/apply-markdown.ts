import { renderBadgeMarkup } from './markdown.ts'
import type { ReadmeBadge, ReadmeDocument, ReadmeSection } from './model.ts'

/**
 * Resolve the effective title a section renders under: a non-blank custom
 * title when the section is a Custom Section, otherwise the section's own
 * title. Mirrors the (unexported) heading-resolution logic in
 * `markdown.ts`'s renderer, so "does this hidden section already have a
 * match among the imported sections" agrees with what would actually be
 * rendered as a `## heading`.
 */
function effectiveSectionTitle(section: ReadmeSection): string {
  if (section.kind === 'custom' && section.fields.customTitle && section.fields.customTitle.trim() !== '') {
    return section.fields.customTitle
  }
  return section.title
}

const SHIELDS_BADGE_PATTERN = /(?:\[)?!\[[^\]]*(?:\\.[^\]]*)*\]\(https:\/\/img\.shields\.io\/badge\/([^)\s]+)\)(?:\]\(([^)\s]+)\))?/g

function decodeComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/%28/g, '(').replace(/%29/g, ')'))
  } catch {
    return value
  }
}

/**
 * Turn a generated badge line back into badges. Returns null unless the line holds only Shields.io badges.
 * An unchanged line keeps the current badges exactly (ids and text); an edited line is parsed best effort.
 */
function parseBadgeLine(line: string, currentBadges: ReadmeBadge[]): ReadmeBadge[] | null {
  const trimmed = line.trim()
  if (trimmed === '') return null
  if (currentBadges.length > 0 && trimmed === currentBadges.map(renderBadgeMarkup).join(' ')) return currentBadges
  const matches = [...trimmed.matchAll(SHIELDS_BADGE_PATTERN)]
  if (matches.length === 0 || trimmed.replace(SHIELDS_BADGE_PATTERN, '').trim() !== '') return null
  return matches.map((match, index) => {
    const parts = match[1].split('-')
    const color = decodeComponent(parts.pop() ?? '')
    const label = decodeComponent(parts.shift() ?? '')
    return {
      id: currentBadges[index]?.id ?? crypto.randomUUID(),
      label,
      message: decodeComponent(parts.join('-')),
      color,
      ...(match[2] ? { link: decodeComponent(match[2]) } : {}),
    }
  })
}

function isGeneratedToc(section: ReadmeSection): boolean {
  if (section.kind !== 'custom' || section.fields.customTitle?.trim().toLowerCase() !== 'table of contents') return false
  const lines = section.body.split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.length > 0 && lines.every((line) => /^[-*]\s+\[.*\]\(#[^)]*\)$/.test(line))
}

/**
 * Merge the result of importing the Markdown tab's buffer back onto the
 * current document, for the "Apply Markdown" in-place-edit flow.
 *
 * Unlike importing a pasted/uploaded README (which intentionally starts a
 * brand-new document), Apply Markdown edits the Markdown-tab buffer of the
 * user's own existing document, so it must:
 *
 * 1. Keep the current document's identity (`id`, `name`) rather than take
 *    the freshly imported document's generated `id`/default `name`.
 * 2. Not silently drop hidden sections. `renderReadme` omits hidden
 *    sections from its Markdown output entirely, so a hidden section in the
 *    current document has no trace in the Markdown buffer and
 *    `importReadme` can never recover it. Any current hidden section whose
 *    effective title has no match among the freshly imported sections is
 *    carried forward unchanged (still hidden) onto the end of the merged
 *    sections.
 */
export function mergeAppliedMarkdown(current: ReadmeDocument, imported: ReadmeDocument): ReadmeDocument {
  let sections = imported.sections
  let badges: ReadmeBadge[] = []

  // The generated badge line lands in the "Imported Content" preamble; turn it back into badges.
  const preamble = sections[0]
  if (preamble?.kind === 'custom' && preamble.fields.customTitle === 'Imported Content') {
    const [firstLine, ...rest] = preamble.body.split('\n')
    const parsed = parseBadgeLine(firstLine, current.badges)
    if (parsed) {
      badges = parsed
      const remaining = rest.join('\n').trim()
      sections = remaining === '' ? sections.slice(1) : [{ ...preamble, body: remaining }, ...sections.slice(1)]
    }
  }

  // A generated "Table of Contents" section becomes the TOC toggle again, so it keeps tracking section changes.
  const includeTableOfContents = sections.some(isGeneratedToc)
  sections = sections.filter((section) => !isGeneratedToc(section))

  const importedTitles = new Set(sections.map(effectiveSectionTitle))
  const carriedHiddenSections = current.sections.filter((section) => !section.visible && !importedTitles.has(effectiveSectionTitle(section)))
  return {
    ...imported,
    id: current.id,
    name: current.name,
    projectType: current.projectType,
    includeTableOfContents,
    badges,
    sections: [...sections, ...carriedHiddenSections],
  }
}
