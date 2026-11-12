const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedOrigin } = require('../src/middleware/requestSecurity.middleware');

test('only exact configured origins are accepted', () => {
  const previous = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://collegebook.example';
  try {
    assert.equal(isAllowedOrigin('https://collegebook.example'), true);
    assert.equal(isAllowedOrigin('https://collegebook.example.attacker.org'), false);
    assert.equal(isAllowedOrigin('https://attacker.org'), false);
    assert.equal(isAllowedOrigin('null'), false);
    assert.equal(isAllowedOrigin(''), false);
  } finally {
    if (previous === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previous;
  }
});
