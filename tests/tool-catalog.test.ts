import assert from 'node:assert/strict'
import test from 'node:test'

import { tools } from '../src/config/tools.ts'

test('marks exactly one tool as new', () => {
  assert.equal(tools.filter((tool) => tool.isNew).length, 1)
})
