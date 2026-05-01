const Business = require('../models/Business');
const Conversation = require('../models/Conversation');
const Subscription = require('../models/Subscription');
const { generateReply, extractLeadInfo } = require('../services/openaiService');
const { sendTextMessage, markAsRead, parseWebhookMessage } = require('../services/whatsappService');
const { checkAiLimit, incrementAiUsage } = require('../middlewares/subscription');

let io;
exports.setIO = (socketIO) => { io = socketIO; };

exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  res.status(403).send('Forbidden');
};

exports.receiveMessage = async (req, res) => {
  res.status(200).send('OK');

  try {
    const parsed = parseWebhookMessage(req.body);
    if (!parsed || !parsed.text) return;

    const { phoneNumberId, from, messageId, text, customerName } = parsed;

    const business = await Business.findOne({ whatsappPhoneNumberId: phoneNumberId });
    if (!business || !business.settings.autoReply) return;

    await markAsRead(phoneNumberId, business.whatsappAccessToken, messageId);

    // ── Subscription / usage check ──────────────────────────────
    let subscription = await Subscription.findOne({ business: business._id });
    if (!subscription) {
      subscription = await Subscription.create({ business: business._id, plan: 'free' });
    }
    await subscription.resetUsageIfNeeded();

    const limitCheck = await checkAiLimit(business, subscription);
    if (!limitCheck.allowed) {
      // Notify business owner via WhatsApp that limit is reached
      const ownerMsg = `⚠️ WA AutoBot: Your ${subscription.plan} plan AI reply limit has been reached for this month. Upgrade at your dashboard to keep AI running. Manual replies still work.`;
      console.log(`[Limit] Business ${business._id} hit AI limit`);
      // Send a polite fallback to the customer
      await sendTextMessage(phoneNumberId, business.whatsappAccessToken, from,
        "Thank you for your message! Our team will get back to you shortly. 🙏"
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
      // ── Increment usage counter ──────────────────────────────
      await incrementAiUsage(subscription);
    } catch (aiErr) {
      console.error('AI error:', aiErr.message);
      replyText = "Thank you for your message! We'll get back to you shortly.";
    }

    await sendTextMessage(phoneNumberId, business.whatsappAccessToken, from, replyText);

    conversation.messages.push({ direction: 'outbound', content: replyText, sentBy: 'ai' });

    if (conversation.messages.length >= 4 && !conversation.isLead) {
      const info = await extractLeadInfo(conversation.messages).catch(() => null);
      if (info?.name && info.name !== 'null') {
        conversation.customerName = info.name || conversation.customerName;
        conversation.customerEmail = info.email || '';
        conversation.customerInterest = info.interest || '';
        conversation.isLead = true;
      }
    }

    await conversation.save();

    if (io) {
      io.to(`business_${business._id}`).emit('new_message', {
        conversationId: conversation._id,
        customerPhone: from,
        customerName: conversation.customerName,
        message: { direction: 'inbound', content: text },
        reply: { direction: 'outbound', content: replyText, sentBy: 'ai' },
      });
    }
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
};
