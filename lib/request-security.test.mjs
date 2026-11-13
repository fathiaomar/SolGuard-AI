import test from 'node:test'
import assert from 'node:assert/strict'
import { isSameOriginRequest } from './request-security.mjs'
import { getSafeReturnPath } from './auth-redirect.mjs'

function request(origin, url = 'https://app.example.test/api/workspace') {
  return new Request(url, { headers: origin === null ? {} : { origin } })
}

test('allows an exact same-origin request', () => {
  assert.equal(isSameOriginRequest(request('https://app.example.test')), true)
})

test('rejects missing, malformed, or opaque origins', () => {
  assert.equal(isSameOriginRequest(request(null)), false)
  assert.equal(isSameOriginRequest(request('null')), false)
  assert.equal(isSameOriginRequest(request('not a URL')), false)
})

test('rejects origins with a different host, scheme, or port', () => {
  assert.equal(isSameOriginRequest(request('https://attacker.example.test')), false)
  assert.equal(isSameOriginRequest(request('http://app.example.test')), false)
  assert.equal(isSameOriginRequest(request('https://app.example.test:8443')), false)
})

test('rejects origin values that include a path', () => {
  assert.equal(isSameOriginRequest(request('https://app.example.test/untrusted/path')), false)
  assert.equal(isSameOriginRequest(request('https://app.example.test/')), false)
})

test('preserves valid internal return destinations', () => {
  const origin = 'https://app.example.test'
  assert.equal(getSafeReturnPath('/reports', origin), '/reports')
  assert.equal(getSafeReturnPath('/projects/123?tab=contracts#list', origin), '/projects/123?tab=contracts#list')
})

test('falls back to the dashboard for untrusted or non-workspace destinations', () => {
  const origin = 'https://app.example.test'
  for (const value of [
    null,
    'reports',
    '//attacker.example.test',
    'https://attacker.example.test',
    '/login',
    '/api/workspace',
    '/projects\\@attacker.example.test',
  ]) {
    assert.equal(getSafeReturnPath(value, origin), '/dashboard', `expected safe fallback for ${value}`)
  }
})