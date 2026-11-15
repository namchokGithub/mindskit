import assert from 'node:assert/strict'
import test from 'node:test'

import { CODE_THEMES, customCodeTheme, tokenizeCode, visibleTokens } from '../src/features/screen-simulator/code-theme.ts'

const kinds = (code: string) => tokenizeCode(code).filter((token) => token.type !== 'plain').map((token) => [token.type, token.text])

test('tokenizes C-family code and round-trips the text exactly', () => {
  const code = '#include <stdio.h>\nint main(void) {\n  // greet\n  printf("hi %d\\n", 0x1F); /* done */\n  Node *n = NULL;\n}\n'
  assert.equal(tokenizeCode(code).map((token) => token.text).join(''), code)
  assert.deepEqual(kinds(code), [
    ['preprocessor', '#include <stdio.h>'],
    ['keyword', 'int'],
    ['function', 'main'],
    ['keyword', 'void'],
    ['comment', '// greet'],
    ['function', 'printf'],
    ['string', '"hi %d\\n"'],
    ['number', '0x1F'],
    ['comment', '/* done */'],
    ['type', 'Node'],
    ['keyword', 'NULL'],
  ])
})

test('keeps unterminated strings and comments inside one token while typing', () => {
  assert.deepEqual(kinds('x = "abc'), [['string', '"abc']])
  assert.deepEqual(kinds('/* open\nstill comment'), [['comment', '/* open\nstill comment']])
  assert.deepEqual(kinds('utf8 = 2.5'), [['number', '2.5']])
})

test('cuts the visible tokens at the typed length', () => {
  const tokens = tokenizeCode('return "ok";')
  assert.deepEqual(visibleTokens(tokens, 9), [{ type: 'keyword', text: 'return' }, { type: 'plain', text: ' ' }, { type: 'string', text: '"o' }])
  assert.deepEqual(visibleTokens(tokens, 0), [])
})

test('offers the classic theme plus IDE themes and a custom theme', () => {
  assert.deepEqual(CODE_THEMES.map((theme) => theme.id), ['classic', 'amber', 'one-dark', 'dracula', 'monokai', 'github-dark', 'solarized-dark', 'github-light'])
  const custom = customCodeTheme('#FF00AA', '#101010')
  assert.equal(custom.background, '#101010')
  assert.equal(custom.colors.keyword, '#FF00AA')
  assert.match(custom.colors.comment, /color-mix\(in oklch, #FF00AA 45%, #101010\)/)
})
