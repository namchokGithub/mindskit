type ScalarKind = 'string' | 'bool' | 'int' | 'float' | 'null'

type Shape =
  | { kind: 'scalar'; value: ScalarKind }
  | { kind: 'object'; properties: Map<string, Property> }
  | { kind: 'array'; element: Shape | null }
  | { kind: 'union'; members: Shape[] }

type Property = { shape: Shape; optional: boolean }

function infer(value: unknown): Shape {
  if (value === null) return { kind: 'scalar', value: 'null' }
  if (typeof value === 'string') return { kind: 'scalar', value: 'string' }
  if (typeof value === 'boolean') return { kind: 'scalar', value: 'bool' }
  if (typeof value === 'number') return { kind: 'scalar', value: Number.isInteger(value) ? 'int' : 'float' }
  if (Array.isArray(value)) return { kind: 'array', element: value.reduce<Shape | null>((shape, item) => shape ? merge(shape, infer(item)) : infer(item), null) }
  if (typeof value === 'object') return { kind: 'object', properties: new Map(Object.entries(value).map(([key, item]) => [key, { shape: infer(item), optional: false }])) }
  return { kind: 'scalar', value: 'null' }
}

function merge(left: Shape, right: Shape): Shape {
  if (left.kind === 'scalar' && right.kind === 'scalar') {
    if (left.value === right.value) return left
    if ((left.value === 'int' && right.value === 'float') || (left.value === 'float' && right.value === 'int')) return { kind: 'scalar', value: 'float' }
  }
  if (left.kind === 'object' && right.kind === 'object') {
    const keys = new Set([...left.properties.keys(), ...right.properties.keys()])
    const properties = new Map<string, Property>()
    for (const key of keys) {
      const leftProperty = left.properties.get(key)
      const rightProperty = right.properties.get(key)
      if (leftProperty && rightProperty) properties.set(key, { shape: merge(leftProperty.shape, rightProperty.shape), optional: leftProperty.optional || rightProperty.optional })
      else if (leftProperty) properties.set(key, { ...leftProperty, optional: true })
      else if (rightProperty) properties.set(key, { ...rightProperty, optional: true })
    }
    return { kind: 'object', properties }
  }
  if (left.kind === 'array' && right.kind === 'array') return { kind: 'array', element: left.element && right.element ? merge(left.element, right.element) : left.element ?? right.element }

  const members = [...(left.kind === 'union' ? left.members : [left]), ...(right.kind === 'union' ? right.members : [right])]
  return { kind: 'union', members }
}

function goName(value: string, fallback: string) {
  const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean)
  const name = words.map((word) => word === 'id' ? 'ID' : word === 'url' ? 'URL' : `${word[0].toUpperCase()}${word.slice(1)}`).join('')
  return name && /^[A-Za-z]/.test(name) ? name : fallback
}

function singular(value: string) {
  return value.endsWith('ies') ? `${value.slice(0, -3)}y` : value.endsWith('s') && value.length > 1 ? value.slice(0, -1) : value
}

function nullable(shape: Shape): boolean {
  return shape.kind === 'scalar' ? shape.value === 'null' : shape.kind === 'union' && shape.members.some(nullable)
}

function withoutNull(shape: Shape): Shape | null {
  if (shape.kind !== 'union') return shape.kind === 'scalar' && shape.value === 'null' ? null : shape
  const members = shape.members.filter((member) => !(member.kind === 'scalar' && member.value === 'null'))
  return members.length === 0 ? null : members.length === 1 ? members[0] : { kind: 'union', members }
}

type Generator = { declarations: string[]; names: Set<string> }

function uniqueName(preferred: string, generator: Generator) {
  let name = preferred
  let count = 2
  while (generator.names.has(name)) name = `${preferred}${count++}`
  generator.names.add(name)
  return name
}

function typeFor(shape: Shape, suggestedName: string, generator: Generator): string {
  const base = withoutNull(shape)
  if (!base) return 'any'
  if (base.kind === 'scalar') return base.value === 'string' ? 'string' : base.value === 'bool' ? 'bool' : base.value === 'int' ? 'int' : base.value === 'float' ? 'float64' : 'any'
  if (base.kind === 'array') return `[]${base.element ? typeFor(base.element, singular(suggestedName), generator) : 'any'}`
  if (base.kind === 'object') return defineStruct(base, suggestedName, generator)
  const types = [...new Set(base.members.map((member) => typeFor(member, suggestedName, generator)))]
  return types.length === 1 ? types[0] : types.every((type) => type === 'int' || type === 'float64') ? 'float64' : 'any'
}

/** Go struct tag literal; JSON string escapes are valid Go escapes, and a backtick forces an interpreted string literal. */
function structTag(jsonName: string) {
  const tag = `json:${JSON.stringify(jsonName)}`
  return tag.includes('`') ? JSON.stringify(tag) : `\`${tag}\``
}

function defineStruct(shape: Extract<Shape, { kind: 'object' }>, suggestedName: string, generator: Generator): string {
  const name = uniqueName(goName(suggestedName, 'Value'), generator)
  const lines: string[] = []
  const fieldNames = new Set<string>()
  for (const [key, property] of shape.properties) {
    const type = typeFor(property.shape, key, generator)
    const shouldPointer = (property.optional || nullable(property.shape)) && type !== 'any' && !type.startsWith('[]')
    const preferredField = goName(key, 'Value')
    let fieldName = preferredField
    let count = 2
    while (fieldNames.has(fieldName)) fieldName = `${preferredField}${count++}`
    fieldNames.add(fieldName)
    // A tag name stops at the first comma (the rest are options), so encoding/json cannot map such keys.
    if (key.includes(',')) lines.push(`\t// JSON key ${JSON.stringify(key)} contains a comma; encoding/json cannot map it with a struct tag.`)
    lines.push(`\t${fieldName} ${shouldPointer ? `*${type}` : type} ${structTag(`${key}${property.optional ? ',omitempty' : ''}`)}`)
  }
  generator.declarations.push(`type ${name} struct {\n${lines.join('\n')}\n}`)
  return name
}

export function jsonToGoStruct(input: string, rootName: string): string {
  const parsed: unknown = JSON.parse(input)
  const root = infer(parsed)
  const generator: Generator = { declarations: [], names: new Set() }
  const normalizedRoot = goName(rootName, 'Root')
  const type = root.kind === 'object' ? defineStruct(root, normalizedRoot, generator) : typeFor(root, normalizedRoot, generator)
  return generator.declarations.length ? generator.declarations.reverse().join('\n\n') : `type ${normalizedRoot} ${type}`
}
