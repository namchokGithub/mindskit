import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// public/_headers allows 'wasm-unsafe-eval' but not 'unsafe-eval', so runtime code must not compile strings.
// @imgly/background-removal bundles ndarray, whose `new Function` code generation is removed by
// patches/@imgly__background-removal@1.7.0.patch. This fails if the patch is missing or the package was upgraded.
test('the background-removal bundle does not compile code with new Function', () => {
  const source = readFileSync(fileURLToPath(import.meta.resolve('@imgly/background-removal')), 'utf8')
  assert.equal(source.includes('new Function('), false, '@imgly/background-removal uses new Function, which the CSP blocks')
})

test('the CSP still forbids unsafe-eval', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
  const scriptSrc = /script-src([^;]*)/.exec(headers)?.[1] ?? ''
  assert.match(scriptSrc, /'wasm-unsafe-eval'/)
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/)
})
