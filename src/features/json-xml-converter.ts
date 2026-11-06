function escapeXml(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function assertXmlName(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9._-]*$/.test(name)) throw new Error(`"${name}" is not a valid XML element name.`)
}

function indent(depth: number) {
  return '  '.repeat(depth)
}

function toXml(value: unknown, name: string, depth: number): string {
  assertXmlName(name)
  const prefix = indent(depth)
  if (value === null || typeof value !== 'object') return `${prefix}<${name}>${escapeXml(value ?? '')}</${name}>`

  const entries = Array.isArray(value)
    ? value.map((item) => ['item', item] as const)
    : Object.entries(value)
  if (!entries.length) return `${prefix}<${name} />`

  return `${prefix}<${name}>\n${entries.map(([key, item]) => toXml(item, key, depth + 1)).join('\n')}\n${prefix}</${name}>`
}

export function jsonToXml(input: string, rootName: string): string {
  const root = rootName.trim() || 'root'
  assertXmlName(root)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(JSON.parse(input), root, 0)}`
}

function elementToValue(element: Element): unknown {
  const children = [...element.children]
  if (!children.length) {
    const text = element.textContent?.trim() ?? ''
    if (!element.attributes.length) return text
    const leaf: Record<string, unknown> = Object.create(null)
    if (text) leaf['#text'] = text
    leaf['@attributes'] = Object.fromEntries([...element.attributes].map((attribute) => [attribute.name, attribute.value]))
    return leaf
  }

  if (children.every((child) => child.tagName === 'item')) return children.map(elementToValue)

  const value: Record<string, unknown> = Object.create(null)
  for (const child of children) {
    const childValue = elementToValue(child)
    const existing = value[child.tagName]
    if (!Object.hasOwn(value, child.tagName)) value[child.tagName] = childValue
    else value[child.tagName] = Array.isArray(existing) ? [...existing, childValue] : [existing, childValue]
  }
  if (element.attributes.length) value['@attributes'] = Object.fromEntries([...element.attributes].map((attribute) => [attribute.name, attribute.value]))
  return value
}

export function xmlToJson(input: string): string {
  const document = new DOMParser().parseFromString(input, 'application/xml')
  const parseError = document.querySelector('parsererror')
  if (parseError) throw new Error(parseError.textContent?.trim() || 'Invalid XML.')
  return JSON.stringify({ [document.documentElement.tagName]: elementToValue(document.documentElement) }, null, 2)
}
