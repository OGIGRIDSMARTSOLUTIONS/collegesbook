const test = require('node:test');
const assert = require('node:assert/strict');
const { passwordResetUrl } = require('../src/utils/passwordResetUrl');

test('reset links point to the configured local frontend', () => {
  assert.equal(passwordResetUrl('abc 123', { FRONTEND_URL: 'http://localhost:5173' }), 'http://localhost:5173/reset-password?token=abc%20123');
});

test('production reset links use HTTPS origin', () => {
  assert.equal(passwordResetUrl('xyz', { FRONTEND_URL: 'https://collegebookz.vercel.app/' }), 'https://collegebookz.vercel.app/reset-password?token=xyz');
});

test('reject missing or unsafe frontend URLs', () => {
  assert.throws(() => passwordResetUrl('x', {}), /FRONTEND_URL is required/);
  assert.throws(() => passwordResetUrl('x', { FRONTEND_URL: 'http://example.com' }), /HTTPS/);
});
