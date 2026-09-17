// backend/tests/htmlEscape.test.js
//
// Regression test: emailService.js / cronService.js interpolate
// user-supplied free text (most commonly the account owner's `name`, set
// at registration with no validation beyond length) directly into HTML
// email bodies. escapeHtml() prevents a name like
// `<img src=x onerror=alert(1)>` from becoming live markup/script in the
// recipient's mail client.

const { escapeHtml } = require('../utils/htmlEscape');

describe('escapeHtml', () => {
  test('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`))
      .toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
  });

  test('leaves ordinary text untouched', () => {
    expect(escapeHtml('Samuel Obi')).toBe('Samuel Obi');
  });

  test('handles null/undefined without throwing', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  test('coerces non-strings', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
