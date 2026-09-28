import type { ReadmeDocument, ReadmeSection } from './model.ts'

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
  const importedTitles = new Set(imported.sections.map(effectiveSectionTitle))
  const carriedHiddenSections = current.sections.filter((section) => !section.visible && !importedTitles.has(effectiveSectionTitle(section)))
  return {
    ...imported,
    id: current.id,
    name: current.name,
    sections: [...imported.sections, ...carriedHiddenSections],
  }
}
