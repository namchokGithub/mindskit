import assert from 'node:assert/strict'
import test from 'node:test'

import * as quickTools from '../src/features/quick-tools.ts'

test('returns the current time as whole Unix seconds', () => {
  assert.equal(quickTools.currentUnixTimestamp?.(1_704_067_200_987), '1704067200')
})
