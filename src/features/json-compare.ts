/** JSON diff used by the JSON Compare page: paths in `$.a.b[0]` form, own keys only, keys sorted. */
export type DifferenceKind = 'added' | 'removed' | 'changed'

export type Difference = {
  kind: DifferenceKind
  path: string
  left?: unknown
  right?: unknown
}

export type Comparison =
  | { ok: true; differences: Difference[] }
  | { ok: false; side: 'left' | 'right'; message: string; line?: number }

type ParsedJson =
  | { ok: true; value: unknown }
  | { ok: false; side: 'left' | 'right'; message: string; line?: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getErrorLine(message: string) {
  const match = message.match(/line (\d+)/i)
  return match ? Number(match[1]) : undefined
}

function parseJson(input: string, side: 'left' | 'right'): ParsedJson {
  if (!input.trim()) return { ok: false, side, message: `${side === 'left' ? 'Left' : 'Right'} JSON is empty.` }
  try {
    return { ok: true, value: JSON.parse(input) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.'
    return { ok: false, side, message, line: getErrorLine(message) }
  }
}

function joinPath(parent: string, key: string | number) {
  return typeof key === 'number' ? `${parent}[${key}]` : parent === '$' ? `$.${key}` : `${parent}.${key}`
}

export function collectDifferences(left: unknown, right: unknown, path = '$', differences: Difference[] = []): Difference[] {
  if (Object.is(left, right)) return differences

  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length)
    for (let index = 0; index < length; index += 1) {
      const nextPath = joinPath(path, index)
      if (index >= left.length) differences.push({ kind: 'added', path: nextPath, right: right[index] })
      else if (index >= right.length) differences.push({ kind: 'removed', path: nextPath, left: left[index] })
      else collectDifferences(left[index], right[index], nextPath, differences)
    }
    return differences
  }

  if (isRecord(left) && isRecord(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    for (const key of [...keys].sort((first, second) => first.localeCompare(second))) {
      const nextPath = joinPath(path, key)
      if (!Object.hasOwn(left, key)) differences.push({ kind: 'added', path: nextPath, right: right[key] })
      else if (!Object.hasOwn(right, key)) differences.push({ kind: 'removed', path: nextPath, left: left[key] })
      else collectDifferences(left[key], right[key], nextPath, differences)
    }
    return differences
  }

  differences.push({ kind: 'changed', path, left, right })
  return differences
}

export function compareJson(leftInput: string, rightInput: string): Comparison {
  const left = parseJson(leftInput, 'left')
  if (!left.ok) return left
  const right = parseJson(rightInput, 'right')
  if (!right.ok) return right
  return { ok: true, differences: collectDifferences(left.value, right.value) }
}
