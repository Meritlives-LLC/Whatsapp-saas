// backend/utils/htmlEscape.js
//
// emailService.js and cronService.js build HTML email bodies with plain
// template-literal interpolation of user-supplied text (most commonly
// `user.name`, which comes straight from registration with no
// sanitization). Escape it before it goes into an <html> body so a name
// like `<img src=x onerror=...>` can't inject markup/scripts into an email
// rendered by the recipient's mail client.
const escapeHtml = (str) => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

module.exports = { escapeHtml };
