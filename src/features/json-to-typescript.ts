type ScalarKind = 'string' | 'boolean' | 'number' | 'null'

type Shape =
  | { kind: 'scalar'; value: ScalarKind }
  | { kind: 'object'; properties: Map<string, Property> }
  | { kind: 'array'; element: Shape | null }
  | { kind: 'union'; members: Shape[] }

type Property = { shape: Shape; optional: boolean }

function infer(value: unknown): Shape {
  if (value === null) return { kind: 'scalar', value: 'null' }
  if (typeof value === 'string') return { kind: 'scalar', value: 'string' }
  if (typeof value === 'boolean') return { kind: 'scalar', value: 'boolean' }
  if (typeof value === 'number') return { kind: 'scalar', value: 'number' }
  if (Array.isArray(value)) return { kind: 'array', element: value.reduce<Shape | null>((shape, item) => shape ? merge(shape, infer(item)) : infer(item), null) }
  if (typeof value === 'object') return { kind: 'object', properties: new Map(Object.entries(value).map(([key, item]) => [key, { shape: infer(item), optional: false }])) }
  return { kind: 'scalar', value: 'null' }
}

function merge(left: Shape, right: Shape): Shape {
  if (left.kind === 'scalar' && right.kind === 'scalar' && left.value === right.value) return left
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

function typeName(value: string, fallback: string) {
  const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean)
  const name = words.map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join('')
  return name && /^[A-Za-z]/.test(name) ? name : fallback
}

function singular(value: string) {
  return value.endsWith('ies') ? `${value.slice(0, -3)}y` : value.endsWith('s') && value.length > 1 ? value.slice(0, -1) : value
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
  if (shape.kind === 'scalar') return shape.value
  if (shape.kind === 'array') {
    const element = shape.element ? typeFor(shape.element, singular(suggestedName), generator) : 'unknown'
    return `Array<${element}>`
  }
  if (shape.kind === 'object') return defineInterface(shape, suggestedName, generator)

  const types = [...new Set(shape.members.map((member) => typeFor(member, suggestedName, generator)))]
  return types.join(' | ')
}

function defineInterface(shape: Extract<Shape, { kind: 'object' }>, suggestedName: string, generator: Generator): string {
  const name = uniqueName(typeName(suggestedName, 'Value'), generator)
  const lines = [...shape.properties].map(([key, property]) => `  ${JSON.stringify(key)}${property.optional ? '?' : ''}: ${typeFor(property.shape, key, generator)};`)
  generator.declarations.push(`interface ${name} {\n${lines.join('\n')}\n}`)
  return name
}

export function jsonToTypeScript(input: string, rootName: string): string {
  const parsed: unknown = JSON.parse(input)
  const root = infer(parsed)
  const generator: Generator = { declarations: [], names: new Set() }
  const normalizedRoot = typeName(rootName, 'Root')
  if (root.kind === 'object') {
    defineInterface(root, normalizedRoot, generator)
    return generator.declarations.reverse().join('\n\n')
  }
  const aliasName = uniqueName(normalizedRoot, generator)
  const itemName = root.kind === 'array' && singular(normalizedRoot) === normalizedRoot ? `${normalizedRoot}Item` : normalizedRoot
  const rootType = typeFor(root, itemName, generator)
  return [...generator.declarations.reverse(), `type ${aliasName} = ${rootType};`].join('\n\n')
}
