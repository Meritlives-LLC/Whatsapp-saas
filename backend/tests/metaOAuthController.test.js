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
});

describe('finalizeConnection outcome via embeddedSignupCallback (Phase 8 — no false "connected")', () => {
  const req = () => ({
    user: { _id: 'user-1' },
    body: { code: 'the-code', wabaId: 'waba-1', phoneNumberId: 'phone-1' },
  });

  beforeEach(() => {
    metaGraph.exchangeEmbeddedCodeForToken.mockResolvedValue('short-token');
    metaGraph.getLongLivedToken.mockResolvedValue('long-token');
    metaGraph.getPhoneNumberDetails.mockResolvedValue({ displayNumber: '+1 555 0100', verifiedName: 'Acme' });
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
