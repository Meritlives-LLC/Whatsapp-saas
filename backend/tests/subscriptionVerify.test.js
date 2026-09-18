// backend/tests/subscriptionVerify.test.js
//
// Regression tests for two gaps found during this audit in
// subscriptionController.verifyUpgrade:
//
// 1. Ownership: the endpoint applied Paystack's verify-response metadata
//    (businessId, planId) to the database without checking it matched the
//    CALLER's own business. Any authenticated user who obtained a valid
//    payment reference belonging to a different tenant could trigger a
//    write against that tenant's subscription from their own session.
//
// 2. Idempotency: Paystack's transaction/verify endpoint returns
//    status: 'success' for a paid transaction indefinitely. Calling this
//    endpoint again with the same reference (e.g. refreshing the
//    post-checkout redirect page) re-extended currentPeriodEnd by another
//    30 days per call, for a single payment. The Paystack *webhook*
//    handlers already guarded against exactly this
//    (paystackService.isAlreadyProcessed) — this manual verify endpoint was
//    the one path that didn't.

jest.mock('../models/Subscription');
jest.mock('../services/paystackService', () => ({
  verifyPayment: jest.fn(),
  isAlreadyProcessed: jest.fn(),
}));
jest.mock('../config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Subscription = require('../models/Subscription');
const paystackService = require('../services/paystackService');
const { verifyUpgrade } = require('../controllers/subscriptionController');

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
  paystackService.isAlreadyProcessed.mockReturnValue(false);
});

describe('verifyUpgrade — ownership check', () => {
  test('rejects a reference whose metadata.businessId belongs to a different business', async () => {
    paystackService.verifyPayment.mockResolvedValue({
      status: 'success',
      amount: 500000,
      metadata: { businessId: 'victim-business', planId: 'growth' },
    });

    const req = {
      body: { reference: 'SUB-123' },
      user: { business: { _id: 'attacker-business' } },
    };
    const res = mockRes();
    await verifyUpgrade(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(Subscription.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('allows a reference whose metadata.businessId matches the caller', async () => {
    paystackService.verifyPayment.mockResolvedValue({
      status: 'success',
      amount: 500000,
      metadata: { businessId: 'biz-1', planId: 'growth' },
    });
    Subscription.findOneAndUpdate.mockResolvedValue({ plan: 'growth', status: 'active', currentPeriodEnd: new Date() });

    const req = {
      body: { reference: 'SUB-123' },
      user: { business: { _id: 'biz-1' } },
    };
    const res = mockRes();
    await verifyUpgrade(req, res);

    expect(res.body.success).toBe(true);
    expect(Subscription.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('verifyUpgrade — idempotency', () => {
  test('a second call with the same reference does not re-extend the period', async () => {
    paystackService.verifyPayment.mockResolvedValue({
      status: 'success',
      amount: 500000,
      metadata: { businessId: 'biz-1', planId: 'growth' },
    });
    Subscription.findOneAndUpdate.mockResolvedValue({ plan: 'growth', status: 'active', currentPeriodEnd: new Date() });
    Subscription.findOne.mockResolvedValue({ plan: 'growth', status: 'active', currentPeriodEnd: new Date() });

    const req = {
      body: { reference: 'SUB-123' },
      user: { business: { _id: 'biz-1' } },
    };

    // First call: not yet processed.
    paystackService.isAlreadyProcessed.mockReturnValueOnce(false);
    await verifyUpgrade(req, mockRes());
    expect(Subscription.findOneAndUpdate).toHaveBeenCalledTimes(1);

    // Second call, same reference: isAlreadyProcessed now reports true.
    paystackService.isAlreadyProcessed.mockReturnValueOnce(true);
    const res2 = mockRes();
    await verifyUpgrade(req, res2);

    expect(Subscription.findOneAndUpdate).toHaveBeenCalledTimes(1); // still just once
    expect(res2.body.success).toBe(true);
    expect(res2.body.alreadyProcessed).toBe(true);
  });
});
