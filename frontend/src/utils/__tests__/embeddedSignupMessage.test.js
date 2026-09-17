import { describe, test, expect } from 'vitest';
import {
  interpretSignupMessage,
  isTrustedSignupOrigin,
  isValidSignupMessage,
} from '../embeddedSignupMessage';

const msg = (origin, payload) => ({ origin, data: JSON.stringify(payload) });

const FINISH = {
  type: 'WA_EMBEDDED_SIGNUP',
  event: 'FINISH',
  data: { waba_id: 'waba-123', phone_number_id: 'phone-456' },
  version: 2,
};

describe('postMessage origin validation', () => {
  test('accepts the exact trusted Facebook origins', () => {
    expect(isTrustedSignupOrigin('https://www.facebook.com')).toBe(true);
    expect(isTrustedSignupOrigin('https://web.facebook.com')).toBe(true);
    expect(isTrustedSignupOrigin('https://m.facebook.com')).toBe(true);
  });

  test('REJECTS suffix-match lookalikes that endsWith("facebook.com") would wrongly accept', () => {
    // These are exactly the origins the old endsWith() check let through.
    expect(isTrustedSignupOrigin('https://evilfacebook.com')).toBe(false);
    expect(isTrustedSignupOrigin('https://notfacebook.com')).toBe(false);
    expect(isTrustedSignupOrigin('https://www.facebook.com.attacker.io')).toBe(false);
  });

  test('rejects wrong scheme, subdomains not on the list, and non-strings', () => {
    expect(isTrustedSignupOrigin('http://www.facebook.com')).toBe(false); // not https
    expect(isTrustedSignupOrigin('https://apps.facebook.com')).toBe(false);
    expect(isTrustedSignupOrigin(null)).toBe(false);
    expect(isTrustedSignupOrigin(undefined)).toBe(false);
    expect(isTrustedSignupOrigin(123)).toBe(false);
  });

  test('a valid FINISH payload from an untrusted origin is ignored entirely', () => {
    expect(interpretSignupMessage(msg('https://evilfacebook.com', FINISH))).toBeNull();
    expect(interpretSignupMessage(msg('https://attacker.example', FINISH))).toBeNull();
  });
});

describe('message shape validation', () => {
  test('accepts a well-formed WA_EMBEDDED_SIGNUP message', () => {
    expect(isValidSignupMessage(FINISH)).toBe(true);
  });

  test('rejects messages of a different type or missing an event string', () => {
    expect(isValidSignupMessage({ type: 'SOMETHING_ELSE', event: 'FINISH' })).toBe(false);
    expect(isValidSignupMessage({ type: 'WA_EMBEDDED_SIGNUP' })).toBe(false);
    expect(isValidSignupMessage({ type: 'WA_EMBEDDED_SIGNUP', event: 42 })).toBe(false);
    expect(isValidSignupMessage(null)).toBe(false);
    expect(isValidSignupMessage('WA_EMBEDDED_SIGNUP')).toBe(false);
  });

  test('ignores non-JSON payloads from a trusted origin without throwing', () => {
    expect(interpretSignupMessage({ origin: 'https://www.facebook.com', data: 'not json at all' })).toBeNull();
  });

  test('ignores unrelated messages from a trusted origin (other Facebook widgets)', () => {
    expect(
      interpretSignupMessage(msg('https://www.facebook.com', { type: 'XFBML.RENDER' }))
    ).toBeNull();
  });
});

describe('lifecycle interpretation', () => {
  test('returns the candidate IDs on FINISH', () => {
    expect(interpretSignupMessage(msg('https://www.facebook.com', FINISH))).toEqual({
      wabaId: 'waba-123',
      phoneNumberId: 'phone-456',
    });
  });

  test('handles FINISH_ONLY_WABA (bypass-phone flow) with no phone_number_id', () => {
    const result = interpretSignupMessage(
      msg('https://www.facebook.com', {
        type: 'WA_EMBEDDED_SIGNUP',
        event: 'FINISH_ONLY_WABA',
        data: { waba_id: 'waba-789' },
      })
    );
    expect(result).toEqual({ wabaId: 'waba-789', phoneNumberId: null });
  });

  test('reports cancellation', () => {
    const result = interpretSignupMessage(
      msg('https://www.facebook.com', { type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL', data: {} })
    );
    expect(result).toEqual({ cancelled: true });
  });

  test('ignores non-terminal lifecycle events rather than guessing', () => {
    expect(
      interpretSignupMessage(msg('https://www.facebook.com', { type: 'WA_EMBEDDED_SIGNUP', event: 'ERROR', data: {} }))
    ).toBeNull();
  });
});
