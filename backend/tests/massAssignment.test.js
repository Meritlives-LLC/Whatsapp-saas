// backend/tests/massAssignment.test.js
//
// Regression test for a vulnerability found during this audit:
// updateProduct / updateAppointment scoped the findOneAndUpdate FILTER to
// the caller's own business (business: bizId), but passed req.body straight
// through as the UPDATE document. `business` is a real, writable field on
// both schemas, so a tenant could PATCH a record it legitimately owns with
// { business: '<victims-business-id>' } in the body and reassign that
// record onto a completely different tenant — e.g. planting an
// attacker-controlled product into a competitor's catalog, which then feeds
// straight into that business's AI system prompt.
//
// The fix allowlists which fields a request body may set (pickAllowed()),
// the same pattern already used by updateBusiness for the WhatsApp
// connection fields.

jest.mock('../models/index', () => ({
  Product: { findOneAndUpdate: jest.fn() },
  Appointment: { findOneAndUpdate: jest.fn() },
  Transaction: {},
  BankAccount: {},
}));
jest.mock('../models/Business');
jest.mock('../models/Conversation');
jest.mock('../models/Subscription');
jest.mock('../services/paystackService', () => ({}));
jest.mock('../services/emailService', () => ({}));
jest.mock('../config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { Product, Appointment } = require('../models/index');
const { updateProduct, updateAppointment } = require('../controllers/businessController');

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
  Product.findOneAndUpdate.mockResolvedValue({ _id: 'prod-1', business: 'biz-1', name: 'Updated' });
  Appointment.findOneAndUpdate.mockResolvedValue({ _id: 'appt-1', business: 'biz-1', status: 'confirmed' });
});

describe('updateProduct — cannot reassign a product to another tenant', () => {
  test('a `business` field in the body is silently dropped, not forwarded to Mongo', async () => {
    const req = {
      user: { business: { _id: 'biz-1' } },
      params: { id: 'prod-1' },
      body: { name: 'New name', business: 'someone-elses-business-id' },
    };
    const res = mockRes();

    await updateProduct(req, res);

    expect(Product.findOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update] = Product.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: 'prod-1', business: 'biz-1' }); // ownership still enforced on read side
    expect(update.$set).not.toHaveProperty('business');           // but never settable via the body
    expect(update.$set).toEqual({ name: 'New name' });
  });

  test('returns 404 rather than a false success when the record is not the caller\'s', async () => {
    Product.findOneAndUpdate.mockResolvedValue(null);
    const req = { user: { business: { _id: 'biz-1' } }, params: { id: 'prod-1' }, body: { name: 'x' } };
    const res = mockRes();

    await updateProduct(req, res);

    expect(res.statusCode).toBe(404);
  });
});

describe('updateAppointment — cannot reassign an appointment to another tenant', () => {
  test('`business`, `conversation` and `reminderSent` in the body are silently dropped', async () => {
    const req = {
      user: { business: { _id: 'biz-1' } },
      params: { id: 'appt-1' },
      body: {
        status: 'confirmed',
        business: 'someone-elses-business-id',
        conversation: 'forged-conversation-id',
        reminderSent: true,
      },
    };
    const res = mockRes();

    await updateAppointment(req, res);

    const [, update] = Appointment.findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ status: 'confirmed' });
  });
});
