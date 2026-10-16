export type TextOperation = {
  label: string
  value: string
}

function words(input: string): string[] {
  return input
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function titleCase(input: string): string {
  return words(input)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export const textOperations = {
  removeSpaces: [
    { label: 'Remove all whitespace', value: 'all' },
    { label: 'Collapse extra spaces', value: 'extra' },
    { label: 'Trim each line', value: 'trim-lines' },
  ] satisfies TextOperation[],
  decoration: [
    { label: 'UPPERCASE', value: 'upper' },
    { label: 'lowercase', value: 'lower' },
    { label: 'Title Case', value: 'title' },
    { label: 'camelCase', value: 'camel' },
    { label: 'PascalCase', value: 'pascal' },
    { label: 'snake_case', value: 'snake' },
    { label: 'kebab-case', value: 'kebab' },
    { label: 'Add prefix & suffix', value: 'affix' },
  ] satisfies TextOperation[],
}

export function removeSpaces(input: string, mode: string): string {
  if (mode === 'all') return input.replace(/\s/g, '')
  if (mode === 'trim-lines') return input.split(/\r?\n/).map((line) => line.trim()).join('\n')
  return input.replace(/[\t ]+/g, ' ').trim()
}

export function decorateText(input: string, mode: string, prefix = '', suffix = ''): string {
  const sourceWords = words(input)
  switch (mode) {
    case 'upper': return input.toUpperCase()
    case 'lower': return input.toLowerCase()
    case 'title': return titleCase(input)
    case 'camel': return sourceWords.map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('')
    case 'pascal': return sourceWords.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('')
    case 'snake': return sourceWords.map((word) => word.toLowerCase()).join('_')
    case 'kebab': return sourceWords.map((word) => word.toLowerCase()).join('-')
    case 'affix': return `${prefix}${input}${suffix}`
    default: return input
  }
}

const markdownLinePrefix = /^(\s*(?:>\s*)*(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?)(.*)$/

export function formatMarkdown(input: string, mode: string): string {
  if (mode === 'none') return input
  const marker = mode === 'italic' ? '_' : '**'
  return input
    .split(/(\r?\n)/)
    .map((part) => {
      if (/^\r?\n$/.test(part)) return part
      const [, prefix = '', content = ''] = part.match(markdownLinePrefix) ?? []
      const text = content.trim()
      if (!text) return part
      return `${prefix}${marker}${text}${marker}${content.slice(content.trimEnd().length)}`
    })
    .join('')
}

export function splitText(input: string, delimiter: string): string {
  return input.split(delimiter).join('\n')
}

export function joinText(input: string, separator: string): string {
  return input.split(/\r?\n/).join(separator)
}
