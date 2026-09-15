// backend/tests/businessController.test.js
//
// Regression test for a vulnerability found during this audit: the general
// PUT /api/business endpoint (updateBusiness) allowed whatsappPhoneNumberId
// to be set directly by the authenticated customer, bypassing Meta's
// Embedded Signup / OAuth ownership verification entirely. Since that field
// has no unique constraint, two Business documents could collide on the
// same phone_number_id, letting the webhook handler's
// Business.findOne({ whatsappPhoneNumberId }) lookup route one customer's
// incoming WhatsApp messages to a different customer.
//
// whatsappPhoneNumberId / whatsappAccessToken / whatsappBusinessAccountId
// must only ever be written by finalizeConnection() in
// metaOAuthController.js, never through this endpoint.

jest.mock('../models/Business');
jest.mock('../config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Business = require('../models/Business');
const { updateBusiness } = require('../controllers/businessController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Business.findByIdAndUpdate.mockResolvedValue({ _id: 'biz-1' });
});

describe('updateBusiness — WhatsApp connection fields are not customer-writable', () => {
  test('whatsappPhoneNumberId in the request body is silently dropped, not saved', async () => {
    const req = {
      user: { business: { _id: 'biz-1' } },
      body: { name: 'Acme Co', whatsappPhoneNumberId: 'someone-elses-phone-id' },
    };
    await updateBusiness(req, mockRes());

    const [, updateArg] = Business.findByIdAndUpdate.mock.calls[0];
    expect(updateArg.$set.name).toBe('Acme Co');
    expect(updateArg.$set.whatsappPhoneNumberId).toBeUndefined();
  });

  test('whatsappAccessToken in the request body is silently dropped, not saved', async () => {
    const req = {
      user: { business: { _id: 'biz-1' } },
      body: { whatsappAccessToken: 'attacker-supplied-token' },
    };
    await updateBusiness(req, mockRes());

    const [, updateArg] = Business.findByIdAndUpdate.mock.calls[0];
    expect(updateArg.$set.whatsappAccessToken).toBeUndefined();
  });

  test('whatsappBusinessAccountId in the request body is silently dropped, not saved', async () => {
    const req = {
      user: { business: { _id: 'biz-1' } },
      body: { whatsappBusinessAccountId: 'someone-elses-waba-id' },
    };
    await updateBusiness(req, mockRes());

    const [, updateArg] = Business.findByIdAndUpdate.mock.calls[0];
    expect(updateArg.$set.whatsappBusinessAccountId).toBeUndefined();
  });

  test('legitimate, non-Meta fields still save normally', async () => {
    const req = {
      user: { business: { _id: 'biz-1' } },
      body: { name: 'Acme Co', description: 'We sell widgets', settings: { autoReply: false } },
    };
    await updateBusiness(req, mockRes());

    const [, updateArg] = Business.findByIdAndUpdate.mock.calls[0];
    expect(updateArg.$set).toEqual({
      name: 'Acme Co',
      description: 'We sell widgets',
      settings: { autoReply: false },
    });
  });
});
