export type CodeTokenType = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'type' | 'function' | 'preprocessor'

export interface CodeToken {
  type: CodeTokenType
  text: string
}

const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'goto', 'sizeof',
  'struct', 'union', 'enum', 'typedef', 'static', 'const', 'volatile', 'extern', 'register', 'inline', 'unsigned', 'signed',
  'void', 'int', 'char', 'short', 'long', 'float', 'double', 'bool', 'auto', 'class', 'public', 'private', 'protected',
  'new', 'delete', 'this', 'true', 'false', 'null', 'NULL', 'nullptr', 'try', 'catch', 'throw', 'finally', 'function',
  'let', 'var', 'import', 'export', 'from', 'as', 'async', 'await', 'yield', 'typeof', 'instanceof', 'interface', 'type',
  'extends', 'implements', 'package', 'func', 'go', 'defer', 'range', 'map', 'chan', 'def', 'lambda', 'pass', 'None',
  'True', 'False', 'and', 'or', 'not', 'in', 'is', 'with', 'fn', 'mut', 'pub', 'impl', 'use', 'mod', 'match', 'string',
])

/*
 * One pass, tried in order at each position: comment, preprocessor directive at line start, string, number,
 * identifier (classified as keyword / type / function call / plain), then any other single character.
 */
const TOKEN_PATTERN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$(?![\s\S])))|(^[ \t]*#[A-Za-z]+[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?)|(\b0[xX][\dA-Fa-f]+\b|\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/gmy

/**
 * Splits code into colorable tokens with a small C-family tokenizer (C, C++, Java, JavaScript/TypeScript, Go, Rust,
 * and similar). Concatenating the token texts always gives back the input exactly.
 */
export function tokenizeCode(code: string): CodeToken[] {
  const tokens: CodeToken[] = []
  const push = (type: CodeTokenType, text: string) => {
    const last = tokens.at(-1)
    if (last && last.type === type && type === 'plain') last.text += text
    else tokens.push({ type, text })
  }
  TOKEN_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN_PATTERN.exec(code)) !== null) {
    const [text, comment, preprocessor, string, number, identifier] = match
    if (comment) push('comment', text)
    else if (preprocessor) push('preprocessor', text)
    else if (string) push('string', text)
    else if (number) push('number', text)
    else if (identifier) {
      const rest = code.slice(TOKEN_PATTERN.lastIndex)
      if (KEYWORDS.has(identifier)) push('keyword', text)
      else if (/^\s*\(/.test(rest)) push('function', text)
      else if (/^[A-Z]/.test(identifier)) push('type', text)
      else push('plain', text)
    } else push('plain', text)
  }
  return tokens
}

/** The tokens covering the first `length` characters, cutting the last token mid-way while it is being typed. */
export function visibleTokens(tokens: readonly CodeToken[], length: number): CodeToken[] {
  const visible: CodeToken[] = []
  let remaining = length
  for (const token of tokens) {
    if (remaining <= 0) break
    visible.push(token.text.length <= remaining ? token : { type: token.type, text: token.text.slice(0, remaining) })
    remaining -= token.text.length
  }
  return visible
}

export interface CodeTheme {
  id: string
  label: string
  background: string
  cursor: string
  colors: Record<CodeTokenType, string>
}

/** IDE-inspired palettes written for MindsKit (not copied theme files). */
export const CODE_THEMES: CodeTheme[] = [
  { id: 'classic', label: 'Classic Green', background: '#000000', cursor: '#33FF66', colors: { plain: '#33FF66', keyword: '#9DFFB4', string: '#C8FF6A', number: '#7CFFCB', comment: '#1F9E45', type: '#B6FFD0', function: '#E4FFEC', preprocessor: '#5CFF8A' } },
  { id: 'amber', label: 'Amber Terminal', background: '#0B0700', cursor: '#FFB000', colors: { plain: '#FFB000', keyword: '#FFD27A', string: '#FFE3A3', number: '#FFC845', comment: '#9C6B00', type: '#FFDA8A', function: '#FFF1CC', preprocessor: '#FFBF3D' } },
  { id: 'one-dark', label: 'One Dark', background: '#282C34', cursor: '#528BFF', colors: { plain: '#ABB2BF', keyword: '#C678DD', string: '#98C379', number: '#D19A66', comment: '#7F848E', type: '#E5C07B', function: '#61AFEF', preprocessor: '#E06C75' } },
  { id: 'dracula', label: 'Dracula', background: '#282A36', cursor: '#F8F8F2', colors: { plain: '#F8F8F2', keyword: '#FF79C6', string: '#F1FA8C', number: '#BD93F9', comment: '#6272A4', type: '#8BE9FD', function: '#50FA7B', preprocessor: '#FF79C6' } },
  { id: 'monokai', label: 'Monokai', background: '#272822', cursor: '#F8F8F0', colors: { plain: '#F8F8F2', keyword: '#F92672', string: '#E6DB74', number: '#AE81FF', comment: '#88846F', type: '#66D9EF', function: '#A6E22E', preprocessor: '#F92672' } },
  { id: 'github-dark', label: 'GitHub Dark', background: '#0D1117', cursor: '#58A6FF', colors: { plain: '#E6EDF3', keyword: '#FF7B72', string: '#A5D6FF', number: '#79C0FF', comment: '#8B949E', type: '#FFA657', function: '#D2A8FF', preprocessor: '#FF7B72' } },
  { id: 'solarized-dark', label: 'Solarized Dark', background: '#002B36', cursor: '#93A1A1', colors: { plain: '#93A1A1', keyword: '#859900', string: '#2AA198', number: '#D33682', comment: '#586E75', type: '#B58900', function: '#268BD2', preprocessor: '#CB4B16' } },
  { id: 'github-light', label: 'GitHub Light', background: '#FFFFFF', cursor: '#0969DA', colors: { plain: '#1F2328', keyword: '#CF222E', string: '#0A3069', number: '#0550AE', comment: '#6E7781', type: '#953800', function: '#8250DF', preprocessor: '#CF222E' } },
]

/**
 * A theme built from two user colors: every token uses the text color, separated by strength (mixed toward the
 * background) so comments recede and keywords, types, and functions stand out.
 */
export function customCodeTheme(text: string, background: string): CodeTheme {
  const mix = (percent: number) => `color-mix(in oklch, ${text} ${percent}%, ${background})`
  return {
    id: 'custom',
    label: 'Custom',
    background,
    cursor: text,
    colors: { plain: mix(85), keyword: text, string: mix(75), number: mix(90), comment: mix(45), type: text, function: text, preprocessor: mix(70) },
  }
}
