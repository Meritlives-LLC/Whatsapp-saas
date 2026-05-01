const OpenAI = require('openai');

// DeepSeek uses an OpenAI-compatible API
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

/**
 * Generate an AI reply based on business context and conversation history
 */
const generateReply = async (business, conversation, incomingMessage) => {
  const { aiKnowledge, name, description } = business;

  const products = conversation.products || [];
  const recentMessages = conversation.messages.slice(-10);

  const systemPrompt = `
You are a helpful AI customer service assistant for "${name}".

Business Description: ${description || 'A professional business.'}
Working Hours: ${aiKnowledge?.workingHours || 'Monday - Friday, 9am - 5pm'}
Policies: ${aiKnowledge?.policies || 'Standard business policies apply.'}

${aiKnowledge?.faqs?.length ? `FAQs:\n${aiKnowledge.faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}` : ''}

${aiKnowledge?.customInstructions || ''}

INSTRUCTIONS:
You are the official AI customer support assistant for this business.
Your job is ONLY to answer based on the provided business information, products, pricing, FAQs, policies, and instructions — nothing else.

RESPONSE STYLE:
- Be friendly, concise, and professional.
- Make your reply sound human and natural.
- Always reply in the same language the customer uses.
- Keep responses under 150 words unless necessary.
- Start with a warm greeting on first contact only.

ALLOWED CONTENT:
- Information about the business, its products, services, pricing, policies, and FAQs.
- Help customers book appointments (ask for name, preferred date/time, and service).
- Help customers make payments (ask what they want to pay for and offer to generate a payment link).
- Clarify unclear questions by asking politely.

RESTRICTIONS:
- Do NOT invent information that was not provided.
- Do NOT guess unavailable prices, features, or policies.
- Do NOT answer anything unrelated to the business.
- If asked anything outside business scope, say:
  "I can only assist with information related to our business and services."

ERROR HANDLING:
- If unsure, ask for clarification instead of guessing.
- If you cannot answer, politely say so and offer to connect them with a human agent.
- If customer is upset, apologize and speak calmly and reassuringly.

SALES BEHAVIOR:
- If the customer shows buying intent, guide them politely to booking or payment.
- Never pressure the customer. Offer help naturally.
  `.trim();

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentMessages.map(m => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: incomingMessage },
  ];

  const response = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    max_tokens: 300,
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
};

/**
 * Extract lead info from a conversation
 */
const extractLeadInfo = async (messages) => {
  const text = messages
    .slice(-5)
    .map(m => `${m.direction === 'inbound' ? 'Customer' : 'Bot'}: ${m.content}`)
    .join('\n');

  const prompt = `
From this conversation, extract: customer name, email (if any), and main interest/intent.
Reply ONLY as JSON: {"name": "", "email": "", "interest": ""}

Conversation:
${text}
  `.trim();

  const response = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
    temperature: 0,
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch {
    return { name: null, email: null, interest: null };
  }
};

module.exports = { generateReply, extractLeadInfo };