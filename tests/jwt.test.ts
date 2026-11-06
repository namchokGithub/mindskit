import assert from 'node:assert/strict'
import test from 'node:test'

import { encodeJwt, verifyJwtSignature } from '../src/features/jwt.ts'

function encodeSection(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

test('verification accepts a matching HMAC secret', async () => {
  const token = await encodeJwt('{"typ":"JWT"}', '{"sub":"1"}', { algorithm: 'HS256', secret: 'secret' })
  await verifyJwtSignature(token, { secret: 'secret' })
  await assert.rejects(verifyJwtSignature(token, { secret: 'other' }), /Signature verification failed/)
})

test('signature decode errors describe the signature, not the secret', async () => {
  const unsigned = `${encodeSection({ alg: 'HS256', typ: 'JWT' })}.${encodeSection({ sub: '1' })}`
  await assert.rejects(verifyJwtSignature(`${unsigned}.`, { secret: 'secret' }), { message: 'The JWT signature section is empty.' })
  await assert.rejects(verifyJwtSignature(`${unsigned}.!!!`, { secret: 'secret' }), { message: 'The JWT signature is not valid Base64URL data.' })
  await assert.rejects(verifyJwtSignature(`${unsigned}.abc`, { secret: '!!!', secretIsBase64Url: true }), { message: 'The verification secret is not valid Base64URL data.' })
})

test('verification rejects inherited object keys as algorithms', async () => {
  const token = `${encodeSection({ alg: 'constructor' })}.${encodeSection({ sub: '1' })}.abc`
  await assert.rejects(verifyJwtSignature(token, { secret: 'secret' }), /supports HS256, HS384, and HS512 JWTs, not constructor/)
})
