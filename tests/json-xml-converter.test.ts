import assert from 'node:assert/strict'
import test from 'node:test'

import { DOMParser } from 'linkedom'

// Node has no DOMParser; linkedom provides a compatible one for these tests only (devDependency).
// linkedom does not emit <parsererror> for malformed XML, so invalid-input handling is browser-only.
globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser

const { jsonToXml, xmlToJson } = await import('../src/features/json-xml-converter.ts')

test('XML to JSON keeps attributes on leaf elements', () => {
  assert.deepEqual(JSON.parse(xmlToJson('<r><a href="x">t</a><img src="y"/><plain>p</plain></r>')), {
    r: {
      a: { '#text': 't', '@attributes': { href: 'x' } },
      img: { '@attributes': { src: 'y' } },
      plain: 'p',
    },
  })
})

test('XML to JSON treats prototype names as ordinary keys', () => {
  assert.deepEqual(JSON.parse(xmlToJson('<r><constructor>x</constructor><toString>y</toString></r>')), {
    r: { constructor: 'x', toString: 'y' },
  })
})

test('XML to JSON groups repeated tags and item lists into arrays', () => {
  assert.deepEqual(JSON.parse(xmlToJson('<r><tag>a</tag><tag>b</tag><list><item>1</item><item>2</item></list></r>')), {
    r: { tag: ['a', 'b'], list: ['1', '2'] },
  })
})

test('XML to JSON keeps attributes on elements with children', () => {
  assert.deepEqual(JSON.parse(xmlToJson('<r id="7"><a>1</a></r>')), { r: { a: '1', '@attributes': { id: '7' } } })
})

test('JSON to XML output converts back to the same values', () => {
  const xml = jsonToXml('{"name":"MindsKit","tags":["json","xml"]}', 'root')
  assert.deepEqual(JSON.parse(xmlToJson(xml)), { root: { name: 'MindsKit', tags: ['json', 'xml'] } })
})
