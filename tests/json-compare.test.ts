import assert from 'node:assert/strict'
import test from 'node:test'

import { compareJson } from '../src/features/json-compare.ts'

test('reports added, removed, and changed values with JSON paths', () => {
  const result = compareJson('{"a":1,"b":{"c":[1,2]},"gone":true}', '{"a":2,"b":{"c":[1,2,3]},"new":null}')
  assert.deepEqual(result, {
    ok: true,
    differences: [
      { kind: 'changed', path: '$.a', left: 1, right: 2 },
      { kind: 'added', path: '$.b.c[2]', right: 3 },
      { kind: 'removed', path: '$.gone', left: true },
      { kind: 'added', path: '$.new', right: null },
    ],
  })
})

test('treats prototype names as ordinary keys', () => {
  assert.deepEqual(compareJson('{}', '{"toString":1}'), { ok: true, differences: [{ kind: 'added', path: '$.toString', right: 1 }] })
  assert.deepEqual(compareJson('{"constructor":1}', '{}'), { ok: true, differences: [{ kind: 'removed', path: '$.constructor', left: 1 }] })
})

test('reports matching documents and parse errors by side', () => {
  assert.deepEqual(compareJson('{"x":[1,{"y":2}]}', '{ "x": [1, { "y": 2 }] }'), { ok: true, differences: [] })
  const empty = compareJson('  ', '{}')
  assert.equal(empty.ok, false)
  assert.equal(!empty.ok && empty.side, 'left')
  const invalid = compareJson('{}', '{"a":}')
  assert.equal(!invalid.ok && invalid.side, 'right')
})
