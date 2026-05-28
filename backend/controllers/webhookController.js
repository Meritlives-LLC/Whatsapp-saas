const Business = require('../models/Business');
const Conversation = require('../models/Conversation');
const Subscription = require('../models/Subscription');
const { generateReply, extractLeadInfo } = require('../services/openaiService');
const { sendTextMessage, markAsRead, parseWebhookMessage } = require('../services/whatsappService');
const { checkAiLimit, incrementAiUsage } = require('../middlewares/subscription');
const logger = require('../config/logger');

let io;
exports.setIO = (socketIO) => { io = socketIO; };

const FALLBACK_REPLIES = {
  image:    `Thanks for sending that image! 📸 One of our team members will review it and get back to you shortly.`,
  audio:    `Thanks for your voice message! 🎙️ We'll listen to it and reply as soon as possible.`,
  video:    `Thanks for the video! 🎥 Our team will review it and get back to you shortly.`,
  document: `Thanks for sending that document! 📄 Our team will review it and get back to you shortly.`,
  sticker:  `Hey there! 👋 How can we help you today?`,
  location: `Thanks for sharing your location! 📍 We'll use this to assist you better.`,
  contacts: `Thanks for sharing that contact! We'll get back to you shortly.`,
  reaction: null,
};

const NON_TEXT_TYPES = new Set(Object.keys(FALLBACK_REPLIES));

exports.verifyWebhook = (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!mode || !token) return res.status(400).send('Bad Request');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('✅ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Forbidden');
};

exports.receiveMessage = async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const parsed = parseWebhookMessage(req.body);
    if (!parsed) return;

    const { phoneNumberId, from, messageId, text, customerName, type } = parsed;

    // ── Non-text fallback ─────────────────────────────────────────────────────
    if (NON_TEXT_TYPES.has(type)) {
      const fallbackText = FALLBACK_REPLIES[type];
      if (!fallbackText) return;

      const business = await Business.findOne({ whatsappPhoneNumberId: phoneNumberId });
      if (!business || !business.settings?.autoReply) return;

      await markAsRead(phoneNumberId, business.whatsappAccessToken, messageId).catch(() => {});

      let conversation = await Conversation.findOne({ business: business._id, customerPhone: from });
      if (!conversation) {
        conversation = await Conversation.create({
          business: business._id, customerPhone: from, customerName, messages: [],
        });
      }

      conversation.messages.push({ direction: 'inbound', content: `[${type}]`, whatsappMessageId: messageId });
      conversation.messages.push({ direction: 'outbound', content: fallbackText, sentBy: 'ai' });
      conversation.lastMessageAt = new Date();
      conversation.status = 'open';
      await conversation.save();

      await sendTextMessage(phoneNumberId, business.whatsappAccessToken, from, fallbackText);

      if (io) {
        io.to(`business_${business._id}`).emit('new_message', {
          conversationId: conversation._id,
          customerPhone: from,
          customerName: conversation.customerName,
          message: { direction: 'inbound',  content: `[${type}]` },
          reply:   { direction: 'outbound', content: fallbackText, sentBy: 'ai' },
        });
      }
      return;
    }

    // ── Text messages ─────────────────────────────────────────────────────────
    if (!text) return;

    const business = await Business.findOne({ whatsappPhoneNumberId: phoneNumberId });
    if (!business || !business.settings?.autoReply) return;

    await markAsRead(phoneNumberId, business.whatsappAccessToken, messageId).catch(() => {});

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

    let conversation = await Conversation.findOne({ business: business._id, customerPhone: from });
    if (!conversation) {
      conversation = await Conversation.create({
        business: business._id, customerPhone: from, customerName, messages: [],
      });
    }

    conversation.messages.push({ direction: 'inbound', content: text, whatsappMessageId: messageId });
    conversation.lastMessageAt = new Date();
    conversation.status = 'open';

    let replyText;
    try {
      replyText = await generateReply(business, conversation, text);
      if (incrementAiUsage) await incrementAiUsage(subscription);
    } catch (aiErr) {
      logger.error(`AI error: ${aiErr.message}`);
      replyText = "Thank you for your message! We'll get back to you shortly.";
    }

    await sendTextMessage(phoneNumberId, business.whatsappAccessToken, from, replyText);

    conversation.messages.push({ direction: 'outbound', content: replyText, sentBy: 'ai' });

    if (conversation.messages.length >= 4 && !conversation.isLead) {
      const info = await extractLeadInfo(conversation.messages).catch(() => null);
      if (info?.name && info.name !== 'null') {
        conversation.customerName     = info.name     || conversation.customerName;
        conversation.customerEmail    = info.email    || '';
        conversation.customerInterest = info.interest || '';
        conversation.isLead = true;
      }
    }

    await conversation.save();

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