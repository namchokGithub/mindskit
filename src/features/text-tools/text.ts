export type TextOperation = {
  label: string
  value: string
}

// Word pieces for case conversion, tried in order at each position:
// 1. a Thai run (letters, digits and combining marks) stays whole, because Thai has no case or spaces between words;
// 2. an acronym followed by a capitalized word (XMLHttp -> XML, Http);
// 3. an optionally capitalized lowercase word (userName -> user, Name);
// 4. a remaining uppercase run (ID, URL);
// 5. a digit run, always its own word (version2Beta -> version, 2, Beta; utf8 -> utf, 8);
// 6. any other uncased letters (CJK, Arabic, ...) or stray combining marks.
// Combining marks (\p{M}) always stay attached to the letter before them.
const wordPiece = /\p{Script=Thai}[\p{Script=Thai}\p{M}]*|(?:[\p{Lu}\p{Lt}]\p{M}*)+(?=[\p{Lu}\p{Lt}]\p{M}*\p{Ll})|(?:[\p{Lu}\p{Lt}]\p{M}*)?(?:\p{Ll}\p{M}*)+|(?:[\p{Lu}\p{Lt}]\p{M}*)+|\p{N}+|(?:(?![\p{Script=Thai}\p{Lu}\p{Lt}\p{Ll}\p{N}])[\p{L}\p{M}])+/gu

export function words(input: string): string[] {
  return input.match(wordPiece) ?? []
}

function capitalize(word: string): string {
  const [first = '', ...rest] = word
  return first.toUpperCase() + rest.join('').toLowerCase()
}

// Title Case only changes letters: every word (apostrophes inside a word such as "don't" are kept in it)
// gets an uppercase first letter and lowercase remaining letters; all other characters stay as they are.
function titleCase(input: string): string {
  return input.replace(/[\p{L}\p{M}\p{N}]+(?:['\u2019][\p{L}\p{M}\p{N}]+)*/gu, capitalize)
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
    case 'camel': return sourceWords.map((word, index) => index === 0 ? word.toLowerCase() : capitalize(word)).join('')
    case 'pascal': return sourceWords.map(capitalize).join('')
    case 'snake': return sourceWords.map((word) => word.toLowerCase()).join('_')
    case 'kebab': return sourceWords.map((word) => word.toLowerCase()).join('-')
    case 'affix': return `${prefix}${input}${suffix}`
    default: return input
  }
}

const markdownLinePrefix = /^(\s*(?:>\s*)*(?:#{1,6}\s+|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)?)(.*)$/

const markdownFence = /^\s{0,3}(`{3,}|~{3,})/
const markdownHorizontalRule = /^\s{0,3}([-*_])(?:[\t ]*\1){2,}[\t ]*$/
const markdownTableRow = /^\s*\|/

function isWrappedIn(text: string, marker: string): boolean {
  if (text.length <= marker.length * 2 || !text.startsWith(marker) || !text.endsWith(marker)) return false
  // `__text__` is bold, not italic, so it does not count as already wrapped in `_`.
  return marker !== '_' || !/^__(?!_)/.test(text)
}

// Wraps each line's content in the marker, keeping list/heading/quote prefixes outside it.
// Fenced code blocks (fence lines and their contents), horizontal rules, table rows and lines
// already wrapped in the same marker are left unchanged. Fences are only recognized at the
// start of a line (up to three spaces of indentation), not inside quotes or lists.
export function formatMarkdown(input: string, mode: string): string {
  if (mode === 'none') return input
  const marker = mode === 'italic' ? '_' : '**'
  let openFence: string | null = null
  return input
    .split(/(\r?\n)/)
    .map((part) => {
      if (/^\r?\n$/.test(part)) return part
      const fence = part.match(markdownFence)?.[1]
      if (openFence) {
        if (fence && fence[0] === openFence[0] && fence.length >= openFence.length && part.trim() === fence) openFence = null
        return part
      }
      if (fence) {
        openFence = fence
        return part
      }
      if (markdownHorizontalRule.test(part) || markdownTableRow.test(part)) return part
      const [, prefix = '', content = ''] = part.match(markdownLinePrefix) ?? []
      const text = content.trim()
      if (!text || isWrappedIn(text, marker)) return part
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
