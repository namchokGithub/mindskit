import assert from 'node:assert/strict'
import test from 'node:test'
import { createTableToTypes, formatSql, formatSqlInClause, generateSqlInserts, minifySql, parseCsv, previewSqlParameters, quoteSqlIdentifier, validateSqlSyntax, type SqlInsertOptions } from '../src/features/sql.ts'

const defaults: SqlInsertOptions = { dialect: 'postgresql', source: 'json', table: 'public.users', batchSize: 100, emptyAsNull: false }

test('CSV handles quoted commas, escaped quotes, embedded CRLF, BOM, and final newline', () => {
  assert.deepEqual(parseCsv('\uFEFFid,note\r\n001,"Hello, ""SQL""\r\nworld"\r\n'), [['id', 'note'], ['001', 'Hello, "SQL"\r\nworld']])
  assert.deepEqual(parseCsv('a,b\n1,'), [['a', 'b'], ['1', '']])
  assert.throws(() => parseCsv('a\n"unclosed'), /Unclosed/)
  assert.throws(() => parseCsv('a\n"closed"extra'), /Unexpected/)
  assert.throws(() => parseCsv('a\ninvalid"quote'), /CSV quotes/)
})

test('IN builder preserves spaces and quotes while deduplicating raw text', () => {
  assert.equal(formatSqlInClause("O'Brien\nNew York\nO'Brien", 'users.name', true), 'WHERE "users"."name" IN (\n  \'O\'\'Brien\',\n  \'New York\'\n)')
  assert.match(formatSqlInClause('"a,b",c', 'name', false, { separator: 'csv', notIn: true }), /NOT IN \(\n  'a,b',\n  'c'/)
})

test('numeric IN preserves large digits and rejects expressions', () => {
  assert.match(formatSqlInClause('9007199254740993\n-2.5\n1e3', 'id', false, { valueType: 'number' }), /9007199254740993,\n  -2.5,\n  1e3/)
  assert.throws(() => formatSqlInClause('1); DROP TABLE users;--', 'id', false, { valueType: 'number' }), /Invalid numeric/)
  assert.throws(() => formatSqlInClause('', 'id', true), /at least one/)
})

test('identifier delimiters are escaped and empty path segments are rejected', () => {
  assert.equal(quoteSqlIdentifier('a.b"c', 'postgresql'), '"a"."b""c"')
  assert.equal(quoteSqlIdentifier('a.b`c', 'mysql'), '`a`.`b``c`')
  assert.equal(quoteSqlIdentifier('a.b]c', 'transactsql'), '[a].[b]]c]')
  assert.throws(() => quoteSqlIdentifier('a..b', 'postgresql'), /identifier/)
})

test('INSERT handles mixed JSON types, missing own fields, and batches', () => {
  const input = '[{"id":1,"name":"O\'Brien","active":true,"constructor":"own"},{"id":2,"active":false,"note":null}]'
  const sql = generateSqlInserts(input, { ...defaults, batchSize: 1 })
  assert.equal(sql.match(/INSERT INTO/g)?.length, 2)
  assert.ok(sql.includes('(1, \'O\'\'Brien\', TRUE, \'own\', NULL)'))
  assert.ok(sql.includes('(2, NULL, FALSE, NULL, NULL)'))
  assert.ok(sql.startsWith('INSERT INTO "public"."users"'))
})

test('CSV preserves zeros and literal NULL, with opt-in empty nulls', () => {
  const options = { ...defaults, source: 'csv' as const }
  assert.match(generateSqlInserts('id,note\n001,\n002,NULL', options), /\('001', ''\),\n  \('002', 'NULL'\)/)
  assert.match(generateSqlInserts('id,note\n001,', { ...options, emptyAsNull: true }), /\('001', NULL\)/)
  for (const csv of ['id,id\n1,2', 'id,\n1,2', 'id,name\n1', 'id,name']) {
    assert.throws(() => generateSqlInserts(csv, options))
  }
})

test('INSERT rejects unsupported or lossy input and invalid batch sizes', () => {
  for (const input of ['[]', '{}', '[null]', '[{}]', '[{"n":9007199254740993}]', '[{"n":1e999}]', '[{"nested":{}}]', '[{"nested":[]}]']) {
    assert.throws(() => generateSqlInserts(input, defaults))
  }
  for (const batchSize of [0, 1.5, 1001, NaN]) assert.throws(() => generateSqlInserts('[{"id":1}]', { ...defaults, batchSize }))
})

test('dialects preserve Unicode, backslashes and booleans without literal breakout', () => {
  const input = JSON.stringify([{ name: "ไทย\\'", active: true }])
  assert.ok(generateSqlInserts(input, defaults).includes("E'ไทย\\\\'''"))
  const mysql = generateSqlInserts(input, { ...defaults, dialect: 'mysql' })
  const hex = Buffer.from("ไทย\\'", 'utf8').toString('hex')
  assert.ok(mysql.includes(`CONVERT(X'${hex}' USING utf8mb4), 1`))
  assert.ok(generateSqlInserts(input, { ...defaults, dialect: 'transactsql' }).includes("N'ไทย\\''', 1"))
  assert.throws(() => generateSqlInserts(JSON.stringify([{ text: '\0' }]), defaults), /NUL/)
})

test('formatter handles dialect syntax, literals, comments and indentation', async () => {
  for (const dialect of ['postgresql', 'mysql', 'transactsql'] as const) {
    const identifier = dialect === 'mysql' ? '`name`' : dialect === 'transactsql' ? '[name]' : '"name"'
    const result = await formatSql(`select ${identifier}, 'from where' as note from users -- keep this\nwhere id=1;`, dialect, '4', 'upper')
    assert.ok(result.startsWith('SELECT\n    '))
    assert.ok(result.includes("'from where'"))
    assert.ok(result.includes('-- keep this'))
  }
  assert.ok((await formatSql('select $$hello where$$ from users', 'postgresql', 'tab', 'lower')).includes('$$hello where$$'))
  await assert.rejects(formatSql("select 'unclosed", 'postgresql', '2', 'upper'))
})

test('minifier removes comments and whitespace without altering literals or quoted identifiers', () => {
  assert.equal(
    minifySql("-- note\nSELECT  \"from  where\", 'a  b', `x  y`, [a b], $$c  d$$ /* note */ FROM users"),
    "SELECT \"from  where\",'a  b',`x  y`,[a b],$$c  d$$ FROM users",
  )
  assert.equal(minifySql('SELECT  1  +  2;'), 'SELECT 1+2;')
  assert.throws(() => minifySql('SELECT /* unfinished'), /Unclosed SQL block comment/)
  assert.throws(() => minifySql('SELECT $tag$ unfinished'), /Unclosed PostgreSQL/)
  assert.throws(() => minifySql("SELECT 'unfinished"), /Unclosed SQL quoted/)
})

test('parameter preview substitutes supported placeholders but skips SQL literals and comments', () => {
  assert.equal(previewSqlParameters('SELECT * FROM users WHERE id = $1 AND active = ?', '[42, true]', 'postgresql'), 'SELECT * FROM users WHERE id = 42 AND active = TRUE')
  assert.equal(previewSqlParameters("SELECT ':name', value::text FROM logs WHERE tag = :tag -- :skip", JSON.stringify({ tag: "O'Brien" }), 'postgresql'), "SELECT ':name', value::text FROM logs WHERE tag = 'O''Brien' -- :skip")
  assert.equal(previewSqlParameters('SELECT * FROM users WHERE id = :id', '{"id":7}', 'transactsql'), 'SELECT * FROM users WHERE id = 7')
  assert.throws(() => previewSqlParameters('SELECT * WHERE id = ?', '{}', 'postgresql'), /JSON array/)
  assert.throws(() => previewSqlParameters('SELECT * WHERE id = :id', '{}', 'postgresql'), /Missing value/)
})

test('CREATE TABLE generator produces TypeScript and Go types for common scalar columns', () => {
  const ddl = 'CREATE TABLE public.users (id BIGINT PRIMARY KEY, email VARCHAR(255) NOT NULL, active BOOLEAN, metadata JSONB, created_at TIMESTAMP);'
  assert.equal(createTableToTypes(ddl, 'typescript'), 'export interface Users {\n  id: string\n  email: string\n  active?: boolean | null\n  metadata?: unknown | null\n  created_at?: string | null\n}')
  assert.match(createTableToTypes(ddl, 'go'), /import "encoding\/json"/)
  assert.match(createTableToTypes(ddl, 'go'), /Id int64 `json:"id"`/)
  assert.match(createTableToTypes(ddl, 'go'), /Metadata json.RawMessage `json:"metadata,omitempty"`/)
  assert.throws(() => createTableToTypes('SELECT 1', 'typescript'), /CREATE TABLE/)
})

test('syntax checker reports parser results without executing SQL', async () => {
  assert.deepEqual(await validateSqlSyntax('SELECT id FROM users WHERE active = true', 'postgresql'), { valid: true })
  const invalid = await validateSqlSyntax("SELECT 'unfinished", 'postgresql')
  assert.equal(invalid.valid, false)
  assert.ok(invalid.message)
})

test('minifier never joins tokens into a comment marker', () => {
  assert.equal(minifySql('SELECT 5 - -3 AS x'), 'SELECT 5- -3 AS x')
  assert.equal(minifySql('SELECT 10 / *'), 'SELECT 10/ *')
})
