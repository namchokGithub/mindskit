/**
 * Project types for README templates
 */
export type ProjectType = 'default' | 'blank' | 'web-app' | 'frontend-app' | 'backend-api' | 'cli-tool' | 'library-package' | 'mobile-app' | 'full-stack-app'

/**
 * Section kinds from the 20-entry library
 */
export type SectionKind = 'overview' | 'live-demo' | 'screenshots' | 'features' | 'tech-stack' | 'requirements' | 'installation' | 'usage' | 'configuration' | 'scripts' | 'project-structure' | 'api-reference' | 'testing' | 'deployment' | 'roadmap' | 'contributing' | 'license' | 'acknowledgements' | 'divider' | 'custom'

/**
 * A single section in a README document
 */
export interface ReadmeSection {
  id: string
  kind: SectionKind
  title: string
  visible: boolean
  fields: Record<string, string>
  body: string
}

/**
 * A badge to display under the main heading
 */
export interface ReadmeBadge {
  id: string
  label: string
  message: string
  color: string
  link?: string
}

/**
 * A complete README document
 */
export interface ReadmeDocument {
  version: 1
  id: string
  name: string
  title: string
  projectType: ProjectType
  includeTableOfContents: boolean
  badges: ReadmeBadge[]
  sections: ReadmeSection[]
}

/**
 * A validation issue found in a document
 */
export interface ValidationIssue {
  code: 'document-title-required' | 'blank-custom-title' | 'duplicate-visible-heading' | 'section-required-fields-empty'
  message: string
  sectionId?: string
}

/**
 * Section library with metadata for each kind
 */
interface SectionLibraryEntry {
  kind: SectionKind
  defaultTitle: string
  bodyRequired: boolean
  fields: Record<string, { defaultValue: string; required: boolean }>
}

const SECTION_LIBRARY: Record<SectionKind, SectionLibraryEntry> = {
  overview: {
    kind: 'overview',
    defaultTitle: 'Overview',
    bodyRequired: true,
    fields: {},
  },
  'live-demo': {
    kind: 'live-demo',
    defaultTitle: 'Live Demo',
    bodyRequired: false,
    fields: {
      url: { defaultValue: '', required: true },
    },
  },
  screenshots: {
    kind: 'screenshots',
    defaultTitle: 'Screenshots',
    bodyRequired: true,
    fields: {},
  },
  features: {
    kind: 'features',
    defaultTitle: 'Features',
    bodyRequired: true,
    fields: {},
  },
  'tech-stack': {
    kind: 'tech-stack',
    defaultTitle: 'Tech Stack',
    bodyRequired: true,
    fields: {},
  },
  requirements: {
    kind: 'requirements',
    defaultTitle: 'Requirements',
    bodyRequired: true,
    fields: {},
  },
  installation: {
    kind: 'installation',
    defaultTitle: 'Installation',
    bodyRequired: true,
    fields: {},
  },
  usage: {
    kind: 'usage',
    defaultTitle: 'Usage',
    bodyRequired: true,
    fields: {},
  },
  configuration: {
    kind: 'configuration',
    defaultTitle: 'Configuration',
    bodyRequired: true,
    fields: {},
  },
  scripts: {
    kind: 'scripts',
    defaultTitle: 'Scripts',
    bodyRequired: true,
    fields: {},
  },
  'project-structure': {
    kind: 'project-structure',
    defaultTitle: 'Project Structure',
    bodyRequired: true,
    fields: {},
  },
  'api-reference': {
    kind: 'api-reference',
    defaultTitle: 'API Reference',
    bodyRequired: true,
    fields: {},
  },
  testing: {
    kind: 'testing',
    defaultTitle: 'Testing',
    bodyRequired: true,
    fields: {},
  },
  deployment: {
    kind: 'deployment',
    defaultTitle: 'Deployment',
    bodyRequired: true,
    fields: {},
  },
  roadmap: {
    kind: 'roadmap',
    defaultTitle: 'Roadmap',
    bodyRequired: true,
    fields: {},
  },
  contributing: {
    kind: 'contributing',
    defaultTitle: 'Contributing',
    bodyRequired: true,
    fields: {},
  },
  license: {
    kind: 'license',
    defaultTitle: 'License',
    bodyRequired: true,
    fields: {},
  },
  acknowledgements: {
    kind: 'acknowledgements',
    defaultTitle: 'Acknowledgements',
    bodyRequired: false,
    fields: {},
  },
  divider: {
    kind: 'divider',
    defaultTitle: 'Divider',
    bodyRequired: false,
    fields: {},
  },
  custom: {
    kind: 'custom',
    defaultTitle: 'Custom Section',
    bodyRequired: false,
    fields: {
      customTitle: { defaultValue: '', required: true },
    },
  },
}

/**
 * Template definitions mapping project types to section kinds
 */
const TEMPLATES: Record<ProjectType, SectionKind[]> = {
  default: ['overview', 'features', 'tech-stack', 'installation', 'usage', 'deployment', 'license'],
  blank: [],
  'web-app': ['overview', 'features', 'tech-stack', 'installation', 'usage', 'deployment', 'license'],
  'frontend-app': ['overview', 'live-demo', 'screenshots', 'features', 'tech-stack', 'installation', 'scripts', 'deployment', 'license'],
  'backend-api': ['overview', 'requirements', 'installation', 'api-reference', 'configuration', 'usage', 'testing', 'deployment', 'license'],
  'cli-tool': ['overview', 'installation', 'usage', 'scripts', 'configuration', 'testing', 'license'],
  'library-package': ['overview', 'features', 'tech-stack', 'installation', 'usage', 'api-reference', 'testing', 'contributing', 'license'],
  'mobile-app': ['overview', 'screenshots', 'features', 'installation', 'usage', 'testing', 'license'],
  'full-stack-app': ['overview', 'features', 'tech-stack', 'installation', 'usage', 'scripts', 'api-reference', 'deployment', 'license'],
}

/**
 * Create a new section from a library kind
 */
function createSection(kind: SectionKind): ReadmeSection {
  const entry = SECTION_LIBRARY[kind]
  const fields: Record<string, string> = {}
  for (const [fieldName, fieldDef] of Object.entries(entry.fields)) {
    fields[fieldName] = fieldDef.defaultValue
  }
  return {
    id: crypto.randomUUID(),
    kind,
    title: entry.defaultTitle,
    visible: true,
    fields,
    body: '',
  }
}

/**
 * Create a new README document with the specified project type
 */
export function createDocument(projectType: ProjectType): ReadmeDocument {
  const sectionKinds = TEMPLATES[projectType]
  const sections = sectionKinds.map(createSection)
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: 'Untitled',
    title: 'Project Title',
    projectType,
    includeTableOfContents: false,
    badges: [],
    sections,
  }
}

/**
 * Apply a template to an existing document
 */
export function applyTemplate(document: ReadmeDocument, projectType: ProjectType): ReadmeDocument {
  return {
    ...document,
    projectType,
    sections: TEMPLATES[projectType].map(createSection),
  }
}

/**
 * Add a new section to the document
 */
export function addSection(document: ReadmeDocument, kind: SectionKind): ReadmeDocument {
  return {
    ...document,
    sections: [...document.sections, createSection(kind)],
  }
}

/**
 * Update a section in the document
 */
export function updateSection(document: ReadmeDocument, sectionId: string, update: Partial<Omit<ReadmeSection, 'id' | 'kind'>>): ReadmeDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            ...update,
          }
        : section,
    ),
  }
}

/**
 * Duplicate a section in the document
 */
export function duplicateSection(document: ReadmeDocument, sectionId: string): ReadmeDocument {
  const sectionIndex = document.sections.findIndex((s) => s.id === sectionId)
  if (sectionIndex === -1) return document

  const section = document.sections[sectionIndex]
  const newSection: ReadmeSection = {
    ...section,
    id: crypto.randomUUID(),
  }

  const newSections = [...document.sections]
  newSections.splice(sectionIndex + 1, 0, newSection)

  return {
    ...document,
    sections: newSections,
  }
}

/**
 * Move a section to a new position
 */
export function moveSection(document: ReadmeDocument, sectionId: string, targetIndex: number): ReadmeDocument {
  const currentIndex = document.sections.findIndex((s) => s.id === sectionId)
  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= document.sections.length) {
    return document
  }

  const newSections = [...document.sections]
  const [section] = newSections.splice(currentIndex, 1)
  newSections.splice(targetIndex, 0, section)

  return {
    ...document,
    sections: newSections,
  }
}

/**
 * Validate a document and return any issues found
 */
export function validateDocument(document: ReadmeDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check for blank document title
  if (!document.title || document.title.trim() === '') {
    issues.push({
      code: 'document-title-required',
      message: 'Document title is required',
    })
  }

  // Collect all visible headings and check for required fields/body
  const visibleHeadings = new Map<string, number>()
  for (const section of document.sections) {
    if (!section.visible) continue
    if (section.kind === 'divider') continue

    // Check required fields
    const sectionEntry = SECTION_LIBRARY[section.kind]
    for (const [fieldName, fieldDef] of Object.entries(sectionEntry.fields)) {
      if (fieldDef.required && (!section.fields[fieldName] || section.fields[fieldName].trim() === '')) {
        issues.push({
          code: 'section-required-fields-empty',
          message: `Section "${section.title}" is missing required field: ${fieldName}`,
          sectionId: section.id,
        })
      }
    }

    // Check required body
    if (sectionEntry.bodyRequired && (!section.body || section.body.trim() === '')) {
      issues.push({
        code: 'section-required-fields-empty',
        message: `Section "${section.title}" requires content`,
        sectionId: section.id,
      })
    }

    let heading = section.title
    if (section.kind === 'custom' && section.fields.customTitle) {
      heading = section.fields.customTitle
    }

    if (!heading || heading.trim() === '') {
      if (section.kind === 'custom') {
        issues.push({
          code: 'blank-custom-title',
          message: 'Custom section title cannot be blank',
          sectionId: section.id,
        })
      }
      continue
    }

    const count = visibleHeadings.get(heading) ?? 0
    if (count > 0) {
      issues.push({
        code: 'duplicate-visible-heading',
        message: `Heading "${heading}" appears multiple times in visible sections`,
        sectionId: section.id,
      })
    }
    visibleHeadings.set(heading, count + 1)
  }

  return issues
}

/**
 * Add a document to the history, keeping only the newest `limit` entries
 */
export function pushHistory(history: ReadmeDocument[], next: ReadmeDocument, limit: number = 50): ReadmeDocument[] {
  const newHistory = [...history, next]
  if (newHistory.length > limit) {
    return newHistory.slice(newHistory.length - limit)
  }
  return newHistory
}
