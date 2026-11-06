import assert from 'node:assert/strict'
import test from 'node:test'

import { jsonToCsv } from '../src/features/json-converters.ts'
import { jsonToGoStruct } from '../src/features/json-to-go.ts'
import { jsonToTypeScript } from '../src/features/json-to-typescript.ts'

test('JSON to CSV escapes header names like values', () => {
  assert.equal(jsonToCsv('[{"a,b":1,"say \\"hi\\"":2,"plain":3}]'), '"a,b","say ""hi""",plain\n1,2,3')
})

test('JSON to TypeScript keeps root array alias and item interface names distinct', () => {
  assert.equal(jsonToTypeScript('[{"id":1}]', 'Root'), 'interface RootItem {\n  "id": number;\n}\n\ntype Root = Array<RootItem>;')
  assert.equal(jsonToTypeScript('[{"id":1}]', 'Users'), 'interface User {\n  "id": number;\n}\n\ntype Users = Array<User>;')
  assert.equal(jsonToTypeScript('"x"', 'Root'), 'type Root = string;')
})

test('JSON to Go de-duplicates field names within a struct', () => {
  assert.equal(jsonToGoStruct('{"foo_bar":1,"fooBar":2}', 'Root'), 'type Root struct {\n\tFooBar int `json:"foo_bar"`\n\tFooBar2 int `json:"fooBar"`\n}')
  assert.equal(jsonToGoStruct('{"1":1,"2":2}', 'Root'), 'type Root struct {\n\tValue int `json:"1"`\n\tValue2 int `json:"2"`\n}')
})

test('JSON to Go escapes quotes and backticks in struct tags', () => {
  assert.equal(jsonToGoStruct('{"a\\"b":1}', 'Root'), 'type Root struct {\n\tAB int `json:"a\\"b"`\n}')
  assert.equal(jsonToGoStruct('{"a`b":1}', 'Root'), 'type Root struct {\n\tAB int "json:\\"a`b\\""\n}')
})
