const axios = require('axios');

const BASE_URL = 'https://graph.facebook.com/v21.0';

/**
 * Send a text message via WhatsApp Cloud API
 */
const sendTextMessage = async (phoneNumberId, accessToken, to, text) => {
  const response = await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

/**
 * Send interactive button message
 */
const sendButtonMessage = async (phoneNumberId, accessToken, to, bodyText, buttons) => {
  // buttons: [{id: 'btn_1', title: 'Option 1'}, ...]
  const response = await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.substring(0, 20) },
          })),
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

/**
 * Send list message
 */
const sendListMessage = async (phoneNumberId, accessToken, to, headerText, bodyText, buttonText, sections) => {
  const response = await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: headerText },
        body: { text: bodyText },
        action: { button: buttonText, sections },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

/**
 * Mark message as read
 */
const markAsRead = async (phoneNumberId, accessToken, messageId) => {
  await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );
};

/**
 * Parse incoming webhook message
 */
const parseWebhookMessage = (body) => {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    return {
      phoneNumberId: value.metadata?.phone_number_id,
      from: message.from,
      messageId: message.id,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text?.body || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '',
      customerName: contact?.profile?.name || 'Unknown',
    };
  } catch (err) {
    return null;
  }
};

module.exports = {
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  markAsRead,
  parseWebhookMessage,
};
