// backend/tests/webhookIdempotency.test.js
//
// Regression test for a gap found during this audit: Meta's Cloud API
// webhook delivery is at-least-once — a slow response or transient error
// can cause the same inbound message to be POSTed twice. receiveMessage()
// previously had no dedup check, so a retried delivery would call the AI
// again (double-billing usage), send the customer a second reply, and
// append duplicate rows to conversation.messages. This mirrors the
// idempotency pattern already used for Paystack webhooks
// (paystackService.isAlreadyProcessed), keyed on whatsappMessageId instead.

jest.mock('../models/Business');
jest.mock('../models/Conversation');
jest.mock('../models/Subscription');
jest.mock('../services/openaiService', () => ({
  generateReply: jest.fn().mockResolvedValue('AI reply'),
  extractLeadInfo: jest.fn().mockResolvedValue(null),
}));
jest.mock('../services/whatsappService', () => ({
  sendTextMessage: jest.fn().mockResolvedValue(true),
  markAsRead: jest.fn().mockResolvedValue(true),
  parseWebhookMessage: jest.fn(),
}));
jest.mock('../middlewares/subscription', () => ({
  checkAiLimit: jest.fn().mockResolvedValue({ allowed: true }),
  incrementAiUsage: jest.fn().mockResolvedValue(true),
}));
jest.mock('../config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Business = require('../models/Business');
const Conversation = require('../models/Conversation');
const Subscription = require('../models/Subscription');
const { generateReply } = require('../services/openaiService');
const { sendTextMessage } = require('../services/whatsappService');
const { parseWebhookMessage } = require('../services/whatsappService');
const webhookCtrl = require('../controllers/webhookController');

function mockRes() {
  return { status() { return this; }, send() {} };
}

const PARSED_MESSAGE = {
  phoneNumberId: 'phone-1',
  from: '2348000000000',
  messageId: 'wamid.SAME_MESSAGE_ID',
  text: 'Hello',
  customerName: 'Test Customer',
  type: 'text',
};

beforeEach(() => {
  jest.clearAllMocks();
  parseWebhookMessage.mockReturnValue({ ...PARSED_MESSAGE });
  Business.findOne.mockResolvedValue({
    _id: 'biz-1',
    settings: { autoReply: true },
    whatsappAccessToken: 'token',
  });
  Subscription.findOne.mockResolvedValue({
    resetUsageIfNeeded: jest.fn().mockResolvedValue(true),
  });
  const conversationDoc = {
    _id: 'conv-1',
    messages: [],
    save: jest.fn().mockResolvedValue(true),
  };
  Conversation.findOne.mockResolvedValue(conversationDoc);
  Conversation.create.mockResolvedValue(conversationDoc);
});

describe('receiveMessage — duplicate webhook deliveries are not reprocessed', () => {
  test('the same whatsappMessageId is only processed once', async () => {
    const req = { body: {} };

    await webhookCtrl.receiveMessage(req, mockRes());
    // give the fire-and-forget async body a tick to run
    await new Promise((r) => setTimeout(r, 0));
    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(sendTextMessage).toHaveBeenCalledTimes(1);

    // Meta retries the exact same delivery
    await webhookCtrl.receiveMessage(req, mockRes());
    await new Promise((r) => setTimeout(r, 0));

    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(sendTextMessage).toHaveBeenCalledTimes(1);
  });

  test('a different whatsappMessageId is processed normally', async () => {
    // Fresh ids, unrelated to the other test in this file — the dedup map
    // is intentionally process-lifetime state, so reusing an id already
    // seen elsewhere in this suite would (correctly) be treated as a
    // duplicate. That behavior is exercised by the test above.
    const req = { body: {} };
    parseWebhookMessage.mockReturnValue({ ...PARSED_MESSAGE, messageId: 'wamid.FIRST_OF_A_NEW_PAIR' });
    await webhookCtrl.receiveMessage(req, mockRes());
    await new Promise((r) => setTimeout(r, 0));

    parseWebhookMessage.mockReturnValue({ ...PARSED_MESSAGE, messageId: 'wamid.SECOND_OF_A_NEW_PAIR' });
    await webhookCtrl.receiveMessage(req, mockRes());
    await new Promise((r) => setTimeout(r, 0));

    expect(generateReply).toHaveBeenCalledTimes(2);
    expect(sendTextMessage).toHaveBeenCalledTimes(2);
  });
});
