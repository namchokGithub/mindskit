import test from 'node:test'
import assert from 'node:assert/strict'
import type { SectionKind } from '../src/features/readme-builder/model.ts'
import { addSection, createDocument, duplicateSection, moveSection, pushHistory, updateSection, validateDocument } from '../src/features/readme-builder/model.ts'
import { createBadgeUrl, createTocEntries, importReadme, renderReadme } from '../src/features/readme-builder/markdown.ts'
import { createDraftsAdapter, createMemoryDraftStorage } from '../src/features/readme-builder/drafts.ts'
import { mergeAppliedMarkdown } from '../src/features/readme-builder/apply-markdown.ts'

test('frontend template preloads its documented section order', () => {
  assert.deepEqual(createDocument('frontend-app').sections.map((section) => section.kind), [
    'overview', 'live-demo', 'screenshots', 'features', 'tech-stack',
    'installation', 'scripts', 'deployment', 'license',
  ])
})

test('duplicate and move retain unique ids without mutating input', () => {
  const source = createDocument('default')
  const next = moveSection(duplicateSection(source, source.sections[0].id), source.sections[0].id, 1)
  assert.equal(new Set(next.sections.map((section) => section.id)).size, next.sections.length)
  assert.equal(source.sections.length, 7)
})

test('validation rejects a blank README title and duplicate visible headings', () => {
  assert.ok(validateDocument({ ...createDocument('blank'), title: '' }).some((issue) => issue.code === 'document-title-required'))
})

test('history keeps the newest 50 immutable snapshots', () => {
  const snapshots = Array.from({ length: 51 }, (_, index) => ({ ...createDocument('default'), name: String(index) }))
  const history = snapshots.reduce((current, next) => pushHistory(current, next), [])
  assert.equal(history.length, 50)
  assert.equal(history[0].name, '1')
})

test('validation flags visible sections with empty required body', () => {
  const doc = createDocument('default')
  // Overview has bodyRequired: true and visible: true, body is empty by default
  const issues = validateDocument(doc)
  assert.ok(issues.some((issue) => issue.code === 'section-required-fields-empty' && issue.sectionId === doc.sections[0].id))
})

test('validation does not flag visible sections with no required fields or body', () => {
  const doc = createDocument('blank')
  doc.sections.push({
    id: 'test-id',
    kind: 'acknowledgements',
    title: 'Acknowledgements',
    visible: true,
    fields: {},
    body: '',
  })
  const issues = validateDocument(doc)
  const relevantIssues = issues.filter((issue) => issue.code === 'section-required-fields-empty' && issue.sectionId === 'test-id')
  assert.equal(relevantIssues.length, 0)
})

test('validation does not flag hidden sections with empty required body', () => {
  const doc = createDocument('default')
  const firstSectionId = doc.sections[0].id
  // Hide the first section (overview with required body)
  doc.sections[0].visible = false
  const issues = validateDocument(doc).filter((issue) => issue.code === 'section-required-fields-empty' && issue.sectionId === firstSectionId)
  assert.equal(issues.length, 0)
})

// --- markdown.ts fixtures ---

function documentWithTwoVisibleSectionsNamed(title: string) {
  let document = createDocument('blank')
  document = { ...document, includeTableOfContents: true }
  document = addSection(document, 'custom')
  document = updateSection(document, document.sections[0].id, { fields: { customTitle: title }, body: `${title} section one.` })
  document = addSection(document, 'custom')
  document = updateSection(document, document.sections[1].id, { fields: { customTitle: title }, body: `${title} section two.` })
  document = addSection(document, 'custom')
  document = updateSection(document, document.sections[2].id, {
    fields: { customTitle: 'Hidden section' },
    body: 'Hidden section content.',
    visible: false,
  })
  return document
}

function documentWithTitles(titles: string[]) {
  let document = createDocument('blank')
  for (const title of titles) {
    document = addSection(document, 'custom')
    const section = document.sections.at(-1)!
    document = updateSection(document, section.id, { fields: { customTitle: title }, body: `${title} content.` })
  }
  return document
}

test('renderer preserves visible section order and TOC collisions', () => {
  const markdown = renderReadme(documentWithTwoVisibleSectionsNamed('API'))
  assert.match(markdown, /- \[API\]\(#api\)\n- \[API\]\(#api-1\)/)
  assert.doesNotMatch(markdown, /Hidden section/)
})

test('import preserves unfamiliar content in a custom section', () => {
  const result = importReadme('# Repo\n\n## Mermaid\n\n```mermaid\ngraph TD\n```')
  assert.equal(result.document.sections.at(-1)?.kind, 'custom')
  assert.match(result.document.sections.at(-1)?.body ?? '', /mermaid/)
})

test('TOC slugging handles punctuation and duplicates', () => {
  assert.deepEqual(
    createTocEntries(documentWithTitles(['C++ & API!', 'C++ & API!'])).map((item) => item.href),
    ['#c-api', '#c-api-1'],
  )
})

test('raw HTML stays in the imported custom body', () => {
  assert.match(
    importReadme('# R\n\n## Diagram\n\n<table><tr><td>x</td></tr></table>').document.sections.at(-1)?.body ?? '',
    /<table>/,
  )
})

test('a visible but content-empty section produces no TOC entry and no heading', () => {
  let document = createDocument('blank')
  document = { ...document, includeTableOfContents: true }
  document = addSection(document, 'custom')
  document = updateSection(document, document.sections[0].id, { fields: { customTitle: 'Notes' } })
  assert.deepEqual(createTocEntries(document), [])
  assert.doesNotMatch(renderReadme(document), /## Notes/)
})

test('divider renders a horizontal rule without a heading or TOC entry', () => {
  const document = {
    ...createDocument('blank'),
    includeTableOfContents: true,
    sections: [{
      id: 'divider-id',
      kind: 'divider' as SectionKind,
      title: 'Divider',
      visible: true,
      fields: {},
      body: '',
    }],
  }

  assert.deepEqual(createTocEntries(document), [])
  assert.equal(renderReadme(document), '# Project Title\n\n---\n')
})

test('slug-collision numbering only counts sections that actually render', () => {
  let document = createDocument('blank')
  document = addSection(document, 'custom')
  document = updateSection(document, document.sections[0].id, { fields: { customTitle: 'Features' } })
  document = addSection(document, 'custom')
  document = updateSection(document, document.sections[1].id, { fields: { customTitle: 'Features' }, body: 'Features content.' })
  const entries = createTocEntries(document)
  assert.deepEqual(entries.map((entry) => entry.href), ['#features'])
  assert.match(renderReadme(document), /## Features\n\nFeatures content\./)
})

function documentWithHiddenAndEmptyCustomSections() {
  let document = createDocument('blank')
  document = addSection(document, 'custom')
  document = updateSection(document, document.sections[0].id, {
    fields: { customTitle: 'Hidden' },
    body: 'Hidden content.',
    visible: false,
  })
  document = addSection(document, 'custom')
  // Second section is left empty: no customTitle, no body, so it renders no heading.
  return document
}

test('hidden and empty custom sections generate no empty headings', () => {
  assert.doesNotMatch(renderReadme(documentWithHiddenAndEmptyCustomSections()), /## Hidden|## Custom Section/)
})

test('badge URLs encode unsafe label/message characters', () => {
  assert.match(createBadgeUrl({ label: 'build status', message: 'passing/green', color: 'bright green' }), /build%20status/)
})

test('badges render as Markdown image syntax, not raw HTML tags', () => {
  let document = createDocument('blank')
  document = {
    ...document,
    badges: [
      { id: 'b1', label: 'build', message: 'passing', color: 'green' },
      { id: 'b2', label: 'license', message: 'MIT', color: 'blue', link: 'https://example.com/license' },
    ],
  }
  const markdown = renderReadme(document)
  assert.ok(markdown.includes('![build](https://img.shields.io/badge/build-passing-green)'))
  assert.ok(markdown.includes('[![license](https://img.shields.io/badge/license-MIT-blue)](https://example.com/license)'))
  assert.doesNotMatch(markdown, /<img/)
  assert.doesNotMatch(markdown, /<a href/)
})

test('badge Markdown escapes alt-text brackets and percent-encodes literal parentheses in URLs', () => {
  const badge = { id: 'b3', label: '[beta]', message: 'v1(2)', color: 'blue' }
  const markdown = renderReadme({ ...createDocument('blank'), badges: [badge] })
  assert.ok(markdown.includes('![\\[beta\\]]('), 'alt text should escape literal [ and ]')
  assert.ok(markdown.includes('v1%282%29'), 'literal ( and ) reaching the URL should be percent-encoded')
  assert.ok(!markdown.includes('v1(2)'), 'unescaped parentheses must not appear inside the Markdown link destination')
})

// --- apply-markdown.ts ---

test('mergeAppliedMarkdown preserves the current document id and name', () => {
  const current = { ...createDocument('blank'), name: 'My Project README' }
  const imported = importReadme('# New Title\n\n## Overview\n\nSome text.').document
  const merged = mergeAppliedMarkdown(current, imported)
  assert.equal(merged.id, current.id)
  assert.equal(merged.name, current.name)
  assert.equal(merged.title, 'New Title')
})

test('mergeAppliedMarkdown carries forward a hidden section with no title-match in the imported markdown', () => {
  let current = createDocument('blank')
  current = addSection(current, 'custom')
  current = updateSection(current, current.sections[0].id, {
    fields: { customTitle: 'Internal Notes' },
    body: 'Not for publishing.',
    visible: false,
  })
  current = addSection(current, 'custom')
  current = updateSection(current, current.sections[1].id, { fields: { customTitle: 'Overview' }, body: 'Visible content.' })

  // Simulate the Markdown tab's buffer: renderReadme omits hidden sections entirely.
  const bufferMarkdown = renderReadme(current)
  assert.doesNotMatch(bufferMarkdown, /Internal Notes|Not for publishing/)

  const imported = importReadme(bufferMarkdown).document
  const merged = mergeAppliedMarkdown(current, imported)

  const hidden = merged.sections.find((section) => section.fields.customTitle === 'Internal Notes')
  assert.ok(hidden, 'hidden section should survive the apply-markdown round trip')
  assert.equal(hidden?.visible, false)
  assert.equal(hidden?.body, 'Not for publishing.')
})

test('mergeAppliedMarkdown does not duplicate a hidden section whose title matches an imported section', () => {
  let current = createDocument('blank')
  current = addSection(current, 'custom')
  current = updateSection(current, current.sections[0].id, {
    fields: { customTitle: 'Roadmap' },
    body: 'Old roadmap text.',
    visible: false,
  })
  const imported = importReadme('# Title\n\n## Roadmap\n\nNew roadmap text.').document
  const merged = mergeAppliedMarkdown(current, imported)
  const roadmapSections = merged.sections.filter((section) => section.title === 'Roadmap' || section.fields.customTitle === 'Roadmap')
  assert.equal(roadmapSections.length, 1)
})

// --- drafts.ts ---

test('saveDraft creates then update preserves the same document id', async () => {
  const drafts = createDraftsAdapter(createMemoryDraftStorage())
  const created = await drafts.saveDraft(createDocument('default'))
  const updated = await drafts.saveDraft({ ...(await drafts.loadDraft(created.id))!, name: 'Renamed' })
  assert.equal(updated.id, created.id)
})

test('listDrafts sorts newest first and deleteDraft removes the record', async () => {
  const drafts = createDraftsAdapter(createMemoryDraftStorage())
  const first = await drafts.saveDraft(createDocument('default'))
  const second = await drafts.saveDraft(createDocument('blank'))
  assert.deepEqual((await drafts.listDrafts()).map((entry) => entry.id), [second.id, first.id])
  await drafts.deleteDraft(second.id)
  assert.equal(await drafts.loadDraft(second.id), null)
})

test('loadDraft returns null and renameDraft rejects for a missing id', async () => {
  const drafts = createDraftsAdapter(createMemoryDraftStorage())
  assert.equal(await drafts.loadDraft('missing'), null)
  await assert.rejects(() => drafts.renameDraft('missing', 'x'))
})
