export interface DecodedJwt {
  header: string
  payload: string
  signature: string
  algorithm?: string
  expiresAt?: Date
  isExpired?: boolean
}

export interface JwtVerificationOptions {
  secret: string
  secretIsBase64Url?: boolean
}

export type JwtHmacAlgorithm = 'HS256' | 'HS384' | 'HS512'

export interface JwtEncodingOptions extends JwtVerificationOptions {
  algorithm: JwtHmacAlgorithm
}

function decodeBase64Url(value: string): string {
  if (!value) throw new Error('The token is missing a required section.')

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(base64 + padding)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodeBase64UrlBytes(
  value: string,
  messages: { empty: string; invalid: string },
): Uint8Array<ArrayBuffer> {
  if (!value) throw new Error(messages.empty)

  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  try {
    const binary = atob(base64 + padding)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    throw new Error(messages.invalid)
  }
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const hashByAlgorithm: Record<JwtHmacAlgorithm, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
}

const secretBase64UrlMessages = {
  empty: 'Enter a JWT signature verification secret.',
  invalid: 'The verification secret is not valid Base64URL data.',
}

const signatureBase64UrlMessages = {
  empty: 'The JWT signature section is empty.',
  invalid: 'The JWT signature is not valid Base64URL data.',
}

function formatJson(value: string, section: string): { formatted: string; data: unknown } {
  try {
    const data: unknown = JSON.parse(value)
    return { formatted: JSON.stringify(data, null, 2), data }
  } catch {
    throw new Error(`The JWT ${section} is not valid JSON.`)
  }
}

export function decodeJwt(token: string): DecodedJwt {
  const compactToken = token.trim().replace(/^Bearer\s+/i, '')
  const parts = compactToken.split('.')

  if (parts.length !== 3) {
    throw new Error('Enter a compact JWT with header, payload, and signature sections.')
  }

  try {
    const header = formatJson(decodeBase64Url(parts[0]), 'header')
    const payload = formatJson(decodeBase64Url(parts[1]), 'payload')
    const algorithm = isRecord(header.data) && typeof header.data.alg === 'string'
      ? header.data.alg
      : undefined
    const expiresAt = isRecord(payload.data) && typeof payload.data.exp === 'number'
      ? new Date(payload.data.exp * 1000)
      : undefined

    return {
      header: header.formatted,
      payload: payload.formatted,
      signature: parts[2],
      algorithm,
      expiresAt,
      isExpired: expiresAt ? expiresAt.getTime() <= Date.now() : undefined,
    }
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('Unable to decode this JWT.')
  }
}

/** Verifies JWTs signed with an HMAC (HS256, HS384, or HS512) in the browser. */
export async function verifyJwtSignature(
  token: string,
  { secret, secretIsBase64Url = false }: JwtVerificationOptions,
): Promise<void> {
  const compactToken = token.trim().replace(/^Bearer\s+/i, '')
  const parts = compactToken.split('.')
  if (parts.length !== 3) {
    throw new Error('Enter a compact JWT with header, payload, and signature sections.')
  }

  const decoded = decodeJwt(compactToken)
  const hash = decoded.algorithm && Object.hasOwn(hashByAlgorithm, decoded.algorithm)
    ? hashByAlgorithm[decoded.algorithm as JwtHmacAlgorithm]
    : undefined
  if (!hash) {
    throw new Error(`Signature verification supports HS256, HS384, and HS512 JWTs${decoded.algorithm ? `, not ${decoded.algorithm}` : ''}.`)
  }

  if (!secret) throw new Error('Enter a JWT signature verification secret.')
  if (!crypto?.subtle) throw new Error('Your browser does not support JWT signature verification.')

  const secretBytes: Uint8Array<ArrayBuffer> = secretIsBase64Url
    ? decodeBase64UrlBytes(secret, secretBase64UrlMessages)
    : new TextEncoder().encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: { name: hash } },
    false,
    ['verify'],
  )
  const isValid = await crypto.subtle.verify(
    { name: 'HMAC' },
    key,
    decodeBase64UrlBytes(parts[2], signatureBase64UrlMessages),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )

  if (!isValid) throw new Error('Signature verification failed.')
}

/** Creates an HMAC-signed JWT locally in the browser. */
export async function encodeJwt(
  headerJson: string,
  payloadJson: string,
  { algorithm, secret, secretIsBase64Url = false }: JwtEncodingOptions,
): Promise<string> {
  const header = formatJson(headerJson, 'header').data
  const payload = formatJson(payloadJson, 'payload').data
  if (!isRecord(header)) throw new Error('The JWT header must be a JSON object.')
  if (!isRecord(payload)) throw new Error('The JWT payload must be a JSON object.')
  if (!secret) throw new Error('Enter a JWT signing secret.')
  if (!crypto?.subtle) throw new Error('Your browser does not support JWT signing.')

  const encodedHeader = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ ...header, alg: algorithm })))
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const secretBytes: Uint8Array<ArrayBuffer> = secretIsBase64Url
    ? decodeBase64UrlBytes(secret, secretBase64UrlMessages)
    : new TextEncoder().encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: { name: hashByAlgorithm[algorithm] } },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    { name: 'HMAC' },
    key,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
