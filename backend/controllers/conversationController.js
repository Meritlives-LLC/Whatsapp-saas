const Conversation = require('../models/Conversation');
const { sendTextMessage } = require('../services/whatsappService');
const Business = require('../models/Business');

exports.getConversations = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { business: req.user.business._id };
    if (status) filter.status = status;

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-messages');

    const total = await Conversation.countDocuments(filter);

    res.json({ success: true, data: conversations, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      business: req.user.business._id,
    });
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
    res.json({ success: true, data: conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendManualReply = async (req, res) => {
  try {
    const { message } = req.body;
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      business: req.user.business._id,
    });
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const business = await Business.findById(req.user.business._id);

    // Send via WhatsApp
    await sendTextMessage(
      business.whatsappPhoneNumberId,
      business.whatsappAccessToken,
      conversation.customerPhone,
      message
    );

    // Save message
    conversation.messages.push({
      direction: 'outbound',
      content: message,
      sentBy: 'human',
    });
    conversation.lastMessageAt = new Date();
    await conversation.save();

    res.json({ success: true, message: 'Message sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, business: req.user.business._id },
      { status },
      { new: true }
    );
    res.json({ success: true, data: conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const businessId = req.user.business._id;
    const [total, open, leads, closed] = await Promise.all([
      Conversation.countDocuments({ business: businessId }),
      Conversation.countDocuments({ business: businessId, status: 'open' }),
      Conversation.countDocuments({ business: businessId, isLead: true }),
      Conversation.countDocuments({ business: businessId, status: 'closed' }),
    ]);
    res.json({ success: true, data: { total, open, leads, closed } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
