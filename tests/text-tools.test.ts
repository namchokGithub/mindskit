import assert from 'node:assert/strict'
import test from 'node:test'

import { decorateText, formatMarkdown, words } from '../src/features/text-tools/text.ts'

test('splits words on separators, case boundaries, acronyms and digit runs', () => {
  assert.deepEqual(words('userName'), ['user', 'Name'])
  assert.deepEqual(words('XMLHttpRequest'), ['XML', 'Http', 'Request'])
  assert.deepEqual(words('version2Beta'), ['version', '2', 'Beta'])
  assert.deepEqual(words('  hello world-foo_bar.baz '), ['hello', 'world', 'foo', 'bar', 'baz'])
  assert.deepEqual(words('API_KEY'), ['API', 'KEY'])
})

test('keeps Thai runs and combining marks whole', () => {
  assert.deepEqual(words('สวัสดีครับ ชาวโลก'), ['สวัสดีครับ', 'ชาวโลก'])
  assert.deepEqual(words('helloสวัสดี'), ['hello', 'สวัสดี'])
  assert.deepEqual(words('café au lait'), ['café', 'au', 'lait'])
})

test('converts between case styles using the shared word rules', () => {
  assert.equal(decorateText('userName', 'snake'), 'user_name')
  assert.equal(decorateText('XMLHttpRequest', 'snake'), 'xml_http_request')
  assert.equal(decorateText('version2Beta', 'kebab'), 'version-2-beta')
  assert.equal(decorateText('hello world', 'camel'), 'helloWorld')
  assert.equal(decorateText('xml http request', 'pascal'), 'XmlHttpRequest')
  assert.equal(decorateText('สวัสดี ชาวโลก', 'snake'), 'สวัสดี_ชาวโลก')
})

test('Title Case preserves punctuation, whitespace and line breaks', () => {
  assert.equal(decorateText('hello, world!\nsecond line', 'title'), 'Hello, World!\nSecond Line')
  assert.equal(decorateText('  mIXED   cASE\r\n', 'title'), '  Mixed   Case\r\n')
  assert.equal(decorateText("don't stop", 'title'), "Don't Stop")
})

test('Markdown emphasis wraps ordinary lines and keeps prefixes outside the marker', () => {
  assert.equal(formatMarkdown('- item\n# Title\nplain', 'bold'), '- **item**\n# **Title**\n**plain**')
  assert.equal(formatMarkdown('plain', 'italic'), '_plain_')
  assert.equal(formatMarkdown('keep', 'none'), 'keep')
})

test('Markdown emphasis skips code fences, rules, tables and already wrapped lines', () => {
  assert.equal(formatMarkdown('```js\nconst a = 1\n```\ntext', 'bold'), '```js\nconst a = 1\n```\n**text**')
  assert.equal(formatMarkdown('~~~\n- a\n~~~', 'italic'), '~~~\n- a\n~~~')
  assert.equal(formatMarkdown('---\n* * *\n___', 'bold'), '---\n* * *\n___')
  assert.equal(formatMarkdown('| a | b |\n|---|---|', 'bold'), '| a | b |\n|---|---|')
  assert.equal(formatMarkdown('**done**\n- **item**', 'bold'), '**done**\n- **item**')
  assert.equal(formatMarkdown('_done_', 'italic'), '_done_')
  assert.equal(formatMarkdown('__bold__', 'italic'), '___bold___')
})
