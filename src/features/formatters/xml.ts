import { indentUnit } from '@/lib/indent'
import type { FormatFailure, FormatResult, IndentOption, ValidateResult } from '@/types/format'

interface ParseSuccess {
  ok: true
  doc: Document
  declaration: string
}

type ParseFailure = FormatFailure

function extractDeclaration(input: string): string {
  const match = input.match(/^\s*(<\?xml\s[^?]*\?>)/i)
  return match ? match[1] : ''
}

function extractLineColumn(message: string): { line?: number; column?: number } {
  const combined = message.match(/line\s*(?:number)?[:\s]*?(\d+)[^0-9]*?column[:\s]*?(\d+)/i)
  if (combined) {
    return { line: Number(combined[1]), column: Number(combined[2]) }
  }
  const lineOnly = message.match(/line[:\s]*?(\d+)/i)
  return lineOnly ? { line: Number(lineOnly[1]) } : {}
}

function cleanXmlMessage(raw: string): string {
  return raw
    .replace(/^This page contains the following errors:\s*/i, '')
    .replace(/\s*Below is a rendering of the page up to the first error\.?.*$/is, '')
    .trim()
}

function getParserError(doc: Document): FormatFailure | null {
  const errorNode = doc.getElementsByTagName('parsererror')[0]
  if (!errorNode) return null
  const message = cleanXmlMessage(errorNode.textContent ?? 'Invalid XML.')
  const { line, column } = extractLineColumn(message)
  const display = message.replace(/^error on line \d+ at column \d+:\s*/i, '').trim()
  return { ok: false, message: display || message, line, column }
}

function safeParseXml(input: string): ParseSuccess | ParseFailure {
  if (!input.trim()) {
    return { ok: false, message: 'Input is empty.' }
  }
  const doc = new DOMParser().parseFromString(input, 'application/xml')
  const parserError = getParserError(doc)
  if (parserError) return parserError
  if (!doc.documentElement) {
    return { ok: false, message: 'No root element found.' }
  }
  return { ok: true, doc, declaration: extractDeclaration(input) }
}

const escapeText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttribute = (value: string) => escapeText(value).replace(/"/g, '&quot;')

const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace'

const isWhitespace = (value: string) => /^[ \t\r\n]*$/.test(value)

function resolveXmlSpace(el: Element, inherited: boolean): boolean {
  const value = el.getAttributeNS(XML_NAMESPACE, 'space') ?? el.getAttribute('xml:space')
  if (value === 'preserve') return true
  if (value === 'default') return false
  return inherited
}

function hasTextContent(el: Element): boolean {
  return Array.from(el.childNodes).some(
    (child) =>
      child.nodeType === Node.CDATA_SECTION_NODE ||
      (child.nodeType === Node.TEXT_NODE && !isWhitespace(child.textContent ?? '')),
  )
}

function serializeInline(node: ChildNode, preserve: boolean): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    // Whitespace-only runs inside mixed content still separate words/elements.
    return preserve || !isWhitespace(text) ? escapeText(text) : ' '
  }
  return serializeNode(node, '', 0, false, preserve)
}

function serializeElement(
  el: Element,
  unit: string,
  depth: number,
  pretty: boolean,
  preserve: boolean,
): string {
  const pad = pretty ? unit.repeat(depth) : ''
  const attrs = Array.from(el.attributes)
    .map((attr) => `${attr.name}="${escapeAttribute(attr.value)}"`)
    .join(' ')
  const tagOpen = attrs ? `${el.tagName} ${attrs}` : el.tagName
  const keepSpace = resolveXmlSpace(el, preserve)
  const nodes = Array.from(el.childNodes)

  if (nodes.length === 0) {
    return `${pad}<${tagOpen} />`
  }
  // Text-only, mixed, and xml:space="preserve" content stays inline so text is never altered.
  if (keepSpace || hasTextContent(el)) {
    const inner = nodes.map((child) => serializeInline(child, keepSpace)).join('')
    return `${pad}<${tagOpen}>${inner}</${el.tagName}>`
  }

  // Element-only content: whitespace-only text nodes between children are dropped.
  const children = nodes.filter((child) => child.nodeType !== Node.TEXT_NODE)
  if (children.length === 0) {
    return `${pad}<${tagOpen} />`
  }
  const nl = pretty ? '\n' : ''
  const inner = children
    .map((child) => serializeNode(child, unit, depth + 1, pretty, keepSpace))
    .filter(Boolean)
    .join(nl)
  return `${pad}<${tagOpen}>${nl}${inner}${nl}${pad}</${el.tagName}>`
}

function serializeNode(
  node: ChildNode,
  unit: string,
  depth: number,
  pretty: boolean,
  preserve: boolean,
): string {
  const pad = pretty ? unit.repeat(depth) : ''
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      return serializeElement(node as Element, unit, depth, pretty, preserve)
    case Node.COMMENT_NODE:
      return `${pad}<!--${node.textContent}-->`
    case Node.CDATA_SECTION_NODE:
      return `${pad}<![CDATA[${node.textContent}]]>`
    case Node.PROCESSING_INSTRUCTION_NODE: {
      const pi = node as ProcessingInstruction
      return pi.data ? `${pad}<?${pi.target} ${pi.data}?>` : `${pad}<?${pi.target}?>`
    }
    case Node.TEXT_NODE: {
      const text = node.textContent ?? ''
      return isWhitespace(text) ? '' : `${pad}${escapeText(text)}`
    }
    default:
      return ''
  }
}

const quoteLiteral = (value: string) => (value.includes('"') ? `'${value}'` : `"${value}"`)

function serializeDoctype(doctype: DocumentType): string {
  let out = `<!DOCTYPE ${doctype.name}`
  if (doctype.publicId) {
    out += ` PUBLIC ${quoteLiteral(doctype.publicId)}`
    if (doctype.systemId) out += ` ${quoteLiteral(doctype.systemId)}`
  } else if (doctype.systemId) {
    out += ` SYSTEM ${quoteLiteral(doctype.systemId)}`
  }
  // Most browsers no longer expose the internal subset; keep it when they do.
  const internalSubset = (doctype as DocumentType & { internalSubset?: string | null })
    .internalSubset
  if (internalSubset) out += ` [${internalSubset}]`
  return `${out}>`
}

function serialize(parsed: ParseSuccess, unit: string, pretty: boolean): string {
  const parts: string[] = []
  if (parsed.declaration) parts.push(parsed.declaration)
  for (const node of Array.from(parsed.doc.childNodes)) {
    const out =
      node.nodeType === Node.DOCUMENT_TYPE_NODE
        ? serializeDoctype(node as DocumentType)
        : serializeNode(node, unit, 0, pretty, false)
    if (out) parts.push(out)
  }
  return parts.join(pretty ? '\n' : '')
}

export function formatXml(input: string, indent: IndentOption): FormatResult {
  const parsed = safeParseXml(input)
  if (!parsed.ok) return parsed
  return { ok: true, output: serialize(parsed, indentUnit(indent), true) }
}

export function minifyXml(input: string): FormatResult {
  const parsed = safeParseXml(input)
  if (!parsed.ok) return parsed
  return { ok: true, output: serialize(parsed, '', false) }
}

export function validateXml(input: string): ValidateResult {
  const parsed = safeParseXml(input)
  if (!parsed.ok) {
    return { valid: false, message: parsed.message, line: parsed.line, column: parsed.column }
  }
  return { valid: true }
}
