// frontend/src/utils/embeddedSignupMessage.js
//
// Pure validation helpers for Meta's Embedded Signup `WA_EMBEDDED_SIGNUP`
// postMessage events. Extracted from WhatsAppConnect.jsx so the trust rules
// are unit-testable in isolation.
//
// Meta's own sample code checks `event.origin.endsWith('facebook.com')`, but
// that is a suffix test, not a domain check: 'https://evilfacebook.com' also
// ends with 'facebook.com' and would pass it. We require an exact match
// against the real origins Embedded Signup posts from. If a legitimate
// session event is ever observed from another facebook.com subdomain, add it
// here explicitly — never widen this back to a suffix/substring check.

export const TRUSTED_SIGNUP_ORIGINS = Object.freeze([
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://m.facebook.com',
]);

const TRUSTED_SET = new Set(TRUSTED_SIGNUP_ORIGINS);

export function isTrustedSignupOrigin(origin) {
  return typeof origin === 'string' && TRUSTED_SET.has(origin);
}

/**
 * Validates that a parsed WA_EMBEDDED_SIGNUP message has the shape we expect
 * before any of its fields are trusted.
 */
export function isValidSignupMessage(data) {
  return (
    !!data &&
    typeof data === 'object' &&
    data.type === 'WA_EMBEDDED_SIGNUP' &&
    typeof data.event === 'string'
  );
}

/**
 * Interpret a raw `message` event from the Embedded Signup popup.
 *
 * Returns one of:
 *   null                     — ignore (untrusted origin, unparseable, wrong
 *                              shape, or a non-terminal lifecycle event)
 *   { cancelled: true }      — customer cancelled the flow
 *   { wabaId, phoneNumberId }— flow finished; IDs are CANDIDATES ONLY and
 *                              must still be validated server-side against
 *                              the exchanged token before anything is saved.
 *
 * Per Meta's documented behaviour, event.data is a JSON *string*.
 */
export function interpretSignupMessage(event) {
  if (!event || !isTrustedSignupOrigin(event.origin)) return null;

  let data;
  try {
    data = JSON.parse(event.data);
  } catch {
    return null;
  }
  if (!isValidSignupMessage(data)) return null;

  if (data.event === 'CANCEL') return { cancelled: true };

  // Covers FINISH, FINISH_ONLY_WABA and
  // FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING (Coexistence).
  if (data.event.startsWith('FINISH')) {
    return {
      wabaId: data.data?.waba_id || null,
      phoneNumberId: data.data?.phone_number_id || null,
    };
  }

  // ERROR or an event we don't recognise yet — not necessarily terminal,
  // so keep listening rather than guessing.
  return null;
}
