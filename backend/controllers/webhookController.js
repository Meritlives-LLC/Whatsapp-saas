const Business = require('../models/Business');
const Conversation = require('../models/Conversation');
const Subscription = require('../models/Subscription');
const { generateReply, extractLeadInfo } = require('../services/openaiService');
const { sendTextMessage, markAsRead, parseWebhookMessage } = require('../services/whatsappService');
const { checkAiLimit, incrementAiUsage } = require('../middlewares/subscription');
const logger = require('../config/logger');

let io;
exports.setIO = (socketIO) => { io = socketIO; };

// ─── GET /api/webhook — Meta verification ─────────────────────────────────────
// Meta calls this when you save the webhook URL in their dashboard.
// It sends hub.mode, hub.verify_token, hub.challenge as query params.
// We must respond with the challenge string EXACTLY — plain text, status 200.
exports.verifyWebhook = (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info(`Webhook verify attempt — mode: ${mode}, token: ${token}`);

  if (!mode || !token) {
    logger.warn('Webhook verify: missing mode or token');
    return res.status(400).send('Bad Request');
  }

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('✅ WhatsApp webhook verified successfully');
    // CRITICAL: Must return the challenge as plain text, not JSON
    return res.status(200).send(challenge);
  }

  logger.warn(`Webhook verify FAILED — token mismatch. Expected: "${process.env.WHATSAPP_VERIFY_TOKEN}", Got: "${token}"`);
  return res.status(403).send('Forbidden');
};

// ─── POST /api/webhook — Receive messages from Meta ───────────────────────────
exports.receiveMessage = async (req, res) => {
  // CRITICAL: Respond 200 immediately — Meta retries if we don't respond fast
  res.status(200).send('EVENT_RECEIVED');

  try {
    const parsed = parseWebhookMessage(req.body);
    if (!parsed || !parsed.text) return;

    const { phoneNumberId, from, messageId, text, customerName } = parsed;

    // Find business by their WhatsApp Phone Number ID
    const business = await Business.findOne({ whatsappPhoneNumberId: phoneNumberId });
    if (!business || !business.settings?.autoReply) return;

    // Mark message as read (shows blue ticks)
    await markAsRead(phoneNumberId, business.whatsappAccessToken, messageId).catch(() => {});

    // Check subscription / AI usage limit
    let subscription = await Subscription.findOne({ business: business._id });
    if (!subscription) {
      subscription = await Subscription.create({ business: business._id, plan: 'free' });
    }
    if (subscription.resetUsageIfNeeded) await subscription.resetUsageIfNeeded();

    const limitCheck = await checkAiLimit(business, subscription);
    if (limitCheck && !limitCheck.allowed) {
      await sendTextMessage(phoneNumberId, business.whatsappAccessToken, from,
        'Thank you for your message! Our team will get back to you shortly. 🙏'
      );
      return;
    }

    // Get or create conversation
    let conversation = await Conversation.findOne({ business: business._id, customerPhone: from });
    if (!conversation) {
      conversation = await Conversation.create({
        business: business._id, customerPhone: from, customerName, messages: [],
      });
    }

    conversation.messages.push({ direction: 'inbound', content: text, whatsappMessageId: messageId });
    conversation.lastMessageAt = new Date();
    conversation.status = 'open';

    // Generate AI reply
    let replyText;
    try {
      replyText = await generateReply(business, conversation, text);
      if (incrementAiUsage) await incrementAiUsage(subscription);
    } catch (aiErr) {
      logger.error(`AI error: ${aiErr.message}`);
      replyText = "Thank you for your message! We'll get back to you shortly.";
    }

    // Send reply via WhatsApp
    await sendTextMessage(phoneNumberId, business.whatsappAccessToken, from, replyText);

    conversation.messages.push({ direction: 'outbound', content: replyText, sentBy: 'ai' });

    // Auto lead detection
    if (conversation.messages.length >= 4 && !conversation.isLead) {
      const info = await extractLeadInfo(conversation.messages).catch(() => null);
      if (info?.name && info.name !== 'null') {
        conversation.customerName  = info.name  || conversation.customerName;
        conversation.customerEmail = info.email || '';
        conversation.customerInterest = info.interest || '';
        conversation.isLead = true;
      }
    }

    await conversation.save();

    // Real-time dashboard update
    if (io) {
      io.to(`business_${business._id}`).emit('new_message', {
        conversationId: conversation._id,
        customerPhone:  from,
        customerName:   conversation.customerName,
        message: { direction: 'inbound',  content: text },
        reply:   { direction: 'outbound', content: replyText, sentBy: 'ai' },
      });
    }
  } catch (err) {
    logger.error(`Webhook processing error: ${err.message}`);
  }
};
