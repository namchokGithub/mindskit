import assert from 'node:assert/strict'
import test from 'node:test'

import { tools } from '../src/config/tools.ts'

test('marks Screenshot Beautifier as the newest tool', () => {
  const screenshotBeautifier = tools.find((tool) => tool.id === 'screenshot-beautifier')

  assert.equal(screenshotBeautifier?.isNew, true)
})
