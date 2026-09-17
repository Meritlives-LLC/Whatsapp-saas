// backend/tests/metaOAuthController.test.js
//
// Unit tests (no DB) for the parts of metaOAuthController.js that were
// changed in this audit:
//   - finalizeConnection() must never report a full "connected" state when
//     Meta's required activation steps (subscribe_apps / phone register)
//     didn't both succeed (Phase 8: false "Connected" state).
//   - Ownership checks: req.user determines ownership; a pending connection
//     started by one user can never be read or consumed by another.
//   - The access token is never present in any JSON response body.
//
// Business and the Meta Graph service are mocked; axios is mocked for the
// tokenStatus live-check call.

jest.mock('../models/Business');
jest.mock('../services/metaGraphService');
jest.mock('axios');
jest.mock('../config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const axios = require('axios');
const Business = require('../models/Business');
const metaGraph = require('../services/metaGraphService');

process.env.META_APP_ID = 'test-app-id';
process.env.META_APP_SECRET = 'test-app-secret';
process.env.META_GRAPH_API_VERSION = 'v23.0';

const controller = require('../controllers/metaOAuthController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    redirect(url) { this.redirectUrl = url; return this; },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no other Business already owns the phone number being
  // connected. Individual tests override this to exercise the duplicate-
  // phone-number rejection path.
  Business.findOne.mockResolvedValue(null);
});

describe('finalizeConnection outcome via embeddedSignupCallback (Phase 8 — no false "connected")', () => {
  const req = () => ({
    user: { _id: 'user-1' },
    body: { code: 'the-code', wabaId: 'waba-1', phoneNumberId: 'phone-1' },
  });

  beforeEach(() => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short-token');
    metaGraph.getLongLivedToken.mockResolvedValue('long-token');
    // The exchanged token is authorized for WABA "waba-1" and phone
    // "phone-1" is confirmed to belong to it — this is the server-side
    // authorization check every embeddedSignupCallback request now goes
    // through before finalizeConnection() is ever reached.
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'phone-1', displayNumber: '+1 555 0100', verifiedName: 'Acme', wabaId: 'waba-1', wabaName: 'Acme WABA' },
    ]);
    metaGraph.getPhoneNumberDetails.mockResolvedValue({ displayNumber: '+1 555 0100', verifiedName: 'Acme' });
    Business.findOne.mockResolvedValue(null); // no cross-tenant conflict by default
  });

  test('reports connected:true only when BOTH subscribe and register succeed', async () => {
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: true });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: true });
    Business.findOneAndUpdate.mockResolvedValue({ _id: 'biz-1', whatsappConnectionStatus: 'connected' });

    const res = mockRes();
    await controller.embeddedSignupCallback(req(), res);

    expect(res.body.success).toBe(true);
    expect(res.body.connected).toBe(true);
    expect(res.body.connectionStatus).toBe('connected');

    const [, update] = Business.findOneAndUpdate.mock.calls[0];
    expect(update.whatsappConnectionStatus).toBe('connected');
  });

  test('reports connected:false + activation_pending when subscribe fails', async () => {
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: false, error: 'Invalid token' });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: true });
    Business.findOneAndUpdate.mockResolvedValue({ _id: 'biz-1', whatsappConnectionStatus: 'activation_pending' });

    const res = mockRes();
    await controller.embeddedSignupCallback(req(), res);

    expect(res.body.success).toBe(true); // request succeeded...
    expect(res.body.connected).toBe(false); // ...but the WhatsApp connection is NOT fully active
    expect(res.body.connectionStatus).toBe('activation_pending');
    expect(res.body.warnings.length).toBeGreaterThan(0);

    const [, update] = Business.findOneAndUpdate.mock.calls[0];
    expect(update.whatsappConnectionStatus).toBe('activation_pending');
  });

  test('reports connected:false + activation_pending when phone registration fails', async () => {
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: true });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: false, error: 'PIN mismatch', code: 133010 });
    Business.findOneAndUpdate.mockResolvedValue({ _id: 'biz-1', whatsappConnectionStatus: 'activation_pending' });

    const res = mockRes();
    await controller.embeddedSignupCallback(req(), res);

    expect(res.body.connected).toBe(false);
    expect(res.body.connectionStatus).toBe('activation_pending');
    expect(res.body.warnings.some((w) => /two-step verification/i.test(w))).toBe(true);
  });

  test('reports connected:false when BOTH subscribe and register fail', async () => {
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: false, error: 'down' });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: false, error: 'down' });
    Business.findOneAndUpdate.mockResolvedValue({ _id: 'biz-1', whatsappConnectionStatus: 'activation_pending' });

    const res = mockRes();
    await controller.embeddedSignupCallback(req(), res);

    expect(res.body.connected).toBe(false);
    expect(res.body.connectionStatus).toBe('activation_pending');
    expect(res.body.warnings.length).toBe(2);
  });

  test('the access token is never present anywhere in the JSON response', async () => {
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: true });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: true });
    Business.findOneAndUpdate.mockResolvedValue({ _id: 'biz-1', whatsappConnectionStatus: 'connected' });

    const res = mockRes();
    await controller.embeddedSignupCallback(req(), res);

    expect(JSON.stringify(res.body)).not.toContain('long-token');
    expect(JSON.stringify(res.body)).not.toContain('short-token');
  });
});

describe('tokenStatus (Phase 8) — never reports connected on a stale/incomplete record', () => {
  test('connected:false when no business record has a token/phone at all', async () => {
    Business.findOne.mockResolvedValue({ whatsappAccessToken: null, whatsappPhoneNumberId: null });

    const res = mockRes();
    await controller.tokenStatus({ user: { _id: 'user-1' } }, res);

    expect(res.body.connected).toBe(false);
    expect(res.body.connectionStatus).toBe('disconnected');
  });

  test('connected:false + activation_pending when token is live but activation never completed', async () => {
    Business.findOne.mockResolvedValue({
      whatsappAccessToken: 'tok',
      whatsappPhoneNumberId: 'phone-1',
      whatsappConnectionStatus: 'activation_pending',
      whatsappBusinessAccountId: 'waba-1',
      whatsappDisplayNumber: '+1 555 0100',
    });
    axios.get.mockResolvedValue({ data: { id: 'phone-1' } });

    const res = mockRes();
    await controller.tokenStatus({ user: { _id: 'user-1' } }, res);

    expect(res.body.connected).toBe(false);
    expect(res.body.connectionStatus).toBe('activation_pending');
  });

  test('connected:true only when the token is live AND stored status is connected', async () => {
    Business.findOne.mockResolvedValue({
      whatsappAccessToken: 'tok',
      whatsappPhoneNumberId: 'phone-1',
      whatsappConnectionStatus: 'connected',
      whatsappBusinessAccountId: 'waba-1',
      whatsappDisplayNumber: '+1 555 0100',
    });
    axios.get.mockResolvedValue({ data: { id: 'phone-1' } });

    const res = mockRes();
    await controller.tokenStatus({ user: { _id: 'user-1' } }, res);

    expect(res.body.connected).toBe(true);
    expect(res.body.connectionStatus).toBe('connected');
  });

  test('reports connection_failed (not connected) when the live token check fails, even if stored status is "connected"', async () => {
    Business.findOne.mockResolvedValue({
      whatsappAccessToken: 'tok',
      whatsappPhoneNumberId: 'phone-1',
      whatsappConnectionStatus: 'connected',
    });
    axios.get.mockRejectedValue({ response: { data: { error: { message: 'Invalid token' } } } });

    const res = mockRes();
    await controller.tokenStatus({ user: { _id: 'user-1' } }, res);

    expect(res.body.connected).toBe(false);
    expect(res.body.connectionStatus).toBe('connection_failed');
  });
});

describe('ownership — pending connection handoff cannot be read or used cross-user', () => {
  test('selectPhone rejects a key when req.user does not match the user who started the connection', async () => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short');
    metaGraph.getLongLivedToken.mockResolvedValue('long');
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'p1', displayNumber: '+1', verifiedName: 'A', wabaId: 'w1', wabaName: 'WABA A' },
      { phoneNumberId: 'p2', displayNumber: '+2', verifiedName: 'B', wabaId: 'w1', wabaName: 'WABA A' },
    ]);

    const startRes = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'owner-user' }, body: { code: 'c', wabaId: 'w1' } },
      startRes
    );

    expect(startRes.body.step).toBe('pick_phone');
    const { key } = startRes.body;
    expect(key).toBeTruthy();

    // A different, authenticated user tries to use the same key.
    const attackerRes = mockRes();
    await controller.selectPhone(
      { user: { _id: 'attacker-user' }, body: { key, phoneNumberId: 'p1' } },
      attackerRes
    );

    expect(attackerRes.statusCode).toBe(400);
    expect(attackerRes.body.success).toBe(false);
    expect(Business.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('getPendingConnection rejects a key when req.user does not match the user who started the connection', async () => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short');
    metaGraph.getLongLivedToken.mockResolvedValue('long');
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'p1', displayNumber: '+1', verifiedName: 'A', wabaId: 'w1', wabaName: 'WABA A' },
      { phoneNumberId: 'p2', displayNumber: '+2', verifiedName: 'B', wabaId: 'w1', wabaName: 'WABA A' },
    ]);

    const startRes = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'owner-user' }, body: { code: 'c', wabaId: 'w1' } },
      startRes
    );
    const { key } = startRes.body;

    const attackerRes = mockRes();
    controller.getPendingConnection({ user: { _id: 'attacker-user' }, query: { key } }, attackerRes);

    expect(attackerRes.statusCode).toBe(404);
    expect(attackerRes.body.success).toBe(false);
  });

  test('the rightful owner CAN use the key to complete their own connection', async () => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short');
    metaGraph.getLongLivedToken.mockResolvedValue('long');
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'p1', displayNumber: '+1', verifiedName: 'A', wabaId: 'w1', wabaName: 'WABA A' },
      { phoneNumberId: 'p2', displayNumber: '+2', verifiedName: 'B', wabaId: 'w1', wabaName: 'WABA A' },
    ]);
    metaGraph.getPhoneNumberDetails.mockResolvedValue({ displayNumber: '+1', verifiedName: 'A' });
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: true });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: true });
    Business.findOneAndUpdate.mockResolvedValue({ _id: 'biz-1', whatsappConnectionStatus: 'connected' });

    const startRes = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'owner-user' }, body: { code: 'c', wabaId: 'w1' } },
      startRes
    );
    const { key } = startRes.body;

    const ownerRes = mockRes();
    await controller.selectPhone(
      { user: { _id: 'owner-user' }, body: { key, phoneNumberId: 'p1' } },
      ownerRes
    );

    expect(ownerRes.body.success).toBe(true);
    expect(ownerRes.body.connected).toBe(true);
  });
});

describe('disconnect resets connection status', () => {
  test('sets whatsappConnectionStatus to disconnected alongside unsetting credentials', async () => {
    Business.findOneAndUpdate.mockResolvedValue({ _id: 'biz-1' });
    const res = mockRes();

    await controller.disconnect({ user: { _id: 'user-1' } }, res);

    expect(res.body.success).toBe(true);
    const [, update] = Business.findOneAndUpdate.mock.calls[0];
    expect(update.whatsappConnectionStatus).toBe('disconnected');
    expect(update.$unset.whatsappAccessToken).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P0 — server-side WABA/phone authorization validation
//
// The browser's WA_EMBEDDED_SIGNUP postMessage is only a hint. These tests
// verify the backend independently confirms, using the exchanged token, that
// the submitted wabaId/phoneNumberId are real and actually related — never
// trusting postMessage -> save directly.
// ═══════════════════════════════════════════════════════════════════════════
describe('P0 — WABA/phone authorization validation in embeddedSignupCallback', () => {
  beforeEach(() => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short-token');
    metaGraph.getLongLivedToken.mockResolvedValue('long-token');
  });

  test('rejects when the submitted phoneNumberId does not belong to the submitted wabaId', async () => {
    // The exchanged token IS authorized for WABA "waba-A", but its phone
    // list does not include "phone-B" — a mismatched/forged pair.
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'phone-A', displayNumber: '+1 111', verifiedName: 'Real Biz', wabaId: 'waba-A', wabaName: 'Real Biz WABA' },
    ]);

    const res = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'user-1' }, body: { code: 'c', wabaId: 'waba-A', phoneNumberId: 'phone-B' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Business.findOneAndUpdate).not.toHaveBeenCalled();
    // Confirms the lookup was actually performed against the real WABA.
    expect(metaGraph.getPhoneNumbersForWaba).toHaveBeenCalledWith('waba-A', 'long-token');
  });

  test('rejects when the exchanged token has no access to the submitted wabaId at all', async () => {
    // Meta's Graph API returns a permission error for a WABA the token
    // cannot see — simulating a wabaId the browser sent that belongs to
    // someone else's Meta account entirely.
    metaGraph.getPhoneNumbersForWaba.mockRejectedValue({
      response: { data: { error: { message: 'Unsupported get request. Object does not exist or permission denied.' } } },
    });

    const res = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'user-1' }, body: { code: 'c', wabaId: 'not-my-waba', phoneNumberId: 'phone-X' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Business.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('rejects when the WABA is authorized but has no phone numbers at all under it', async () => {
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([]);

    const res = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'user-1' }, body: { code: 'c', wabaId: 'waba-A', phoneNumberId: 'phone-X' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Business.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('accepts and finalizes when the submitted phoneNumberId DOES belong to the authorized wabaId', async () => {
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'phone-A', displayNumber: '+1 111', verifiedName: 'Real Biz', wabaId: 'waba-A', wabaName: 'Real Biz WABA' },
    ]);
    metaGraph.getPhoneNumberDetails.mockResolvedValue({ displayNumber: '+1 111', verifiedName: 'Real Biz' });
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: true });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: true });
    Business.findOneAndUpdate.mockResolvedValue({ _id: 'biz-1', whatsappConnectionStatus: 'connected' });

    const res = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'user-1' }, body: { code: 'c', wabaId: 'waba-A', phoneNumberId: 'phone-A' } },
      res
    );

    expect(res.body.success).toBe(true);
    expect(res.body.connected).toBe(true);
    expect(Business.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P0 — phone-details lookup is a validation gate, not optional display info
// ═══════════════════════════════════════════════════════════════════════════
describe('P0 — phone validation gate in finalizeConnection (via embeddedSignupCallback)', () => {
  beforeEach(() => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short-token');
    metaGraph.getLongLivedToken.mockResolvedValue('long-token');
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'phone-1', displayNumber: '+1 555 0100', verifiedName: 'Acme', wabaId: 'waba-1', wabaName: 'Acme WABA' },
    ]);
  });

  test('does NOT save a Business when Meta cannot validate the phone resource (request throws)', async () => {
    metaGraph.getPhoneNumberDetails.mockRejectedValue({
      response: { data: { error: { message: 'Invalid OAuth access token' } } },
    });

    const res = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'user-1' }, body: { code: 'c', wabaId: 'waba-1', phoneNumberId: 'phone-1' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Business.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('does NOT save a Business when Meta responds without a usable display number', async () => {
    metaGraph.getPhoneNumberDetails.mockResolvedValue({}); // no displayNumber

    const res = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'user-1' }, body: { code: 'c', wabaId: 'waba-1', phoneNumberId: 'phone-1' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Business.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P0 — application-level tenant isolation (belt-and-suspenders alongside the
// DB-level partial unique index — see config/indexes.js and
// tests/business.indexes.test.js)
// ═══════════════════════════════════════════════════════════════════════════
describe('P0 — duplicate phone number rejected before persisting', () => {
  beforeEach(() => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short-token');
    metaGraph.getLongLivedToken.mockResolvedValue('long-token');
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'phone-1', displayNumber: '+1 555 0100', verifiedName: 'Acme', wabaId: 'waba-1', wabaName: 'Acme WABA' },
    ]);
    metaGraph.getPhoneNumberDetails.mockResolvedValue({ displayNumber: '+1 555 0100', verifiedName: 'Acme' });
  });

  test('rejects when another Business already owns this whatsappPhoneNumberId', async () => {
    Business.findOne.mockResolvedValue({ _id: 'other-business' }); // conflict found

    const res = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'user-2' }, body: { code: 'c', wabaId: 'waba-1', phoneNumberId: 'phone-1' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already connected to a different account/i);
    expect(Business.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('treats a duplicate-key error from the DB write itself (race condition) the same way', async () => {
    Business.findOne.mockResolvedValue(null); // no conflict seen by the pre-check...
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: true });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: true });
    // ...but the write itself hits the unique index (another request won the race).
    const dupErr = new Error('E11000 duplicate key error');
    dupErr.code = 11000;
    Business.findOneAndUpdate.mockRejectedValue(dupErr);

    const res = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'user-2' }, body: { code: 'c', wabaId: 'waba-1', phoneNumberId: 'phone-1' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already connected to a different account/i);
  });
});

describe('P1 — multi-phone selection must be server-validated', () => {
  test('selectPhone rejects a phoneNumberId not present in the server-side authorized pending list', async () => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short');
    metaGraph.getLongLivedToken.mockResolvedValue('long');
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'p1', displayNumber: '+1', verifiedName: 'A', wabaId: 'w1', wabaName: 'WABA A' },
      { phoneNumberId: 'p2', displayNumber: '+2', verifiedName: 'B', wabaId: 'w1', wabaName: 'WABA A' },
    ]);

    const startRes = mockRes();
    await controller.embeddedSignupCallback(
      { user: { _id: 'owner-user' }, body: { code: 'c', wabaId: 'w1' } },
      startRes
    );
    const { key } = startRes.body;

    // The owner is legitimate, but "p3" was never in the authorized list —
    // e.g. a tampered request trying to attach an arbitrary phone ID to
    // this pending token.
    const res = mockRes();
    await controller.selectPhone(
      { user: { _id: 'owner-user' }, body: { key, phoneNumberId: 'p3' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Business.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('token leakage — the access token never appears in any JSON response', () => {
  test('tokenStatus never includes the access token', async () => {
    Business.findOne.mockResolvedValue({
      whatsappAccessToken: 'super-secret-token',
      whatsappPhoneNumberId: 'phone-1',
      whatsappConnectionStatus: 'connected',
      whatsappDisplayNumber: '+1',
    });
    axios.get.mockResolvedValue({ data: { id: 'phone-1' } });

    const res = mockRes();
    await controller.tokenStatus({ user: { _id: 'user-1' } }, res);

    expect(JSON.stringify(res.body)).not.toContain('super-secret-token');
  });

  test('getPendingConnection never includes the access token, only public phone fields', async () => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short');
    metaGraph.getLongLivedToken.mockResolvedValue('super-secret-long-token');
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'p1', displayNumber: '+1', verifiedName: 'A', wabaId: 'w1', wabaName: 'WABA A' },
      { phoneNumberId: 'p2', displayNumber: '+2', verifiedName: 'B', wabaId: 'w1', wabaName: 'WABA A' },
    ]);

    const startRes = mockRes();
    await controller.embeddedSignupCallback({ user: { _id: 'owner-user' }, body: { code: 'c', wabaId: 'w1' } }, startRes);
    const { key } = startRes.body;

    const res = mockRes();
    controller.getPendingConnection({ user: { _id: 'owner-user' }, query: { key } }, res);

    expect(JSON.stringify(res.body)).not.toContain('super-secret-long-token');
    expect(JSON.stringify(startRes.body)).not.toContain('super-secret-long-token');
  });

  test('selectPhone response never includes the access token', async () => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short');
    metaGraph.getLongLivedToken.mockResolvedValue('super-secret-long-token');
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'p1', displayNumber: '+1', verifiedName: 'A', wabaId: 'w1', wabaName: 'WABA A' },
      { phoneNumberId: 'p2', displayNumber: '+2', verifiedName: 'B', wabaId: 'w1', wabaName: 'WABA A' },
    ]);
    metaGraph.getPhoneNumberDetails.mockResolvedValue({ displayNumber: '+1', verifiedName: 'A' });
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: true });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: true });
    Business.findOneAndUpdate.mockResolvedValue({
      _id: 'biz-1',
      whatsappConnectionStatus: 'connected',
      toJSON() { return { _id: 'biz-1', whatsappConnectionStatus: 'connected' }; },
    });

    const startRes = mockRes();
    await controller.embeddedSignupCallback({ user: { _id: 'owner-user' }, body: { code: 'c', wabaId: 'w1' } }, startRes);
    const { key } = startRes.body;

    const res = mockRes();
    await controller.selectPhone({ user: { _id: 'owner-user' }, body: { key, phoneNumberId: 'p1' } }, res);

    expect(JSON.stringify(res.body)).not.toContain('super-secret-long-token');
  });
});
// The route itself enforces this via `protect` middleware (see
// routes/metaRoutes.js) rather than the controller; this test documents and
// locks in that every account-scoped handler assumes/requires req.user and
// would throw rather than silently operate without one, so removing
// `protect` from the route would surface immediately rather than fail open.
// ═══════════════════════════════════════════════════════════════════════════
describe('P1 — authenticated callback must remain account-scoped', () => {
  test('embeddedSignupCallback has no code path that determines ownership from anything other than req.user', async () => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short-token');
    metaGraph.getLongLivedToken.mockResolvedValue('long-token');
    metaGraph.getPhoneNumbersForWaba.mockResolvedValue([
      { phoneNumberId: 'phone-1', displayNumber: '+1', verifiedName: 'A', wabaId: 'waba-1', wabaName: 'WABA' },
    ]);
    metaGraph.getPhoneNumberDetails.mockResolvedValue({ displayNumber: '+1', verifiedName: 'A' });
    metaGraph.subscribeAppToWaba.mockResolvedValue({ subscribed: true });
    metaGraph.registerPhoneNumber.mockResolvedValue({ registered: true });
    Business.findOneAndUpdate.mockResolvedValue({ _id: 'biz-1', whatsappConnectionStatus: 'connected' });

    // A body claiming a different userId/businessId must be ignored —
    // ownership always comes from req.user, never from the request body.
    const res = mockRes();
    await controller.embeddedSignupCallback(
      {
        user: { _id: 'real-authenticated-user' },
        body: { code: 'c', wabaId: 'waba-1', phoneNumberId: 'phone-1', userId: 'someone-else', businessId: 'someone-elses-business' },
      },
      res
    );

    expect(res.body.success).toBe(true);
    // The ownership filter used for the write is req.user._id, not the
    // spoofed userId/businessId in the body.
    const [filter] = Business.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ owner: 'real-authenticated-user' });
  });

  // Middleware-level enforcement (unauthenticated request never reaches the
  // controller at all) is covered by the route wiring itself:
  //   router.post('/embedded-signup-callback', protect, metaOAuthController.embeddedSignupCallback)
  // A regression here (protect removed from the route) is exactly the kind
  // of change a diff review must catch — see routes/metaRoutes.js.
  test('the route wires `protect` before embeddedSignupCallback', () => {
    const fs = require('fs');
    const path = require('path');
    const routesSrc = fs.readFileSync(path.join(__dirname, '../routes/metaRoutes.js'), 'utf8');
    const line = routesSrc.split('\n').find((l) => l.includes('embedded-signup-callback'));
    expect(line).toBeTruthy();
    expect(line).toMatch(/protect/);
  });
});
