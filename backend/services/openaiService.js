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
- Be friendly, concise, and professional.
- Make your reply human.
- Start with a warm greeting on first contact.
- Always respond in the same language the customer uses.
- Keep replies under 150 words unless more detail is needed.
- Only answer based on the business information, products, services, pricing, FAQs, policies, and instructions provided.
- Do not guess or create information that is not explicitly provided. If unsure, ask the customer for clarification.
- If a question is outside the business scope, reply: "I can only assist with information related to our business and services."
- If asked about pricing or products, provide the information clearly.
- If a customer wants to book an appointment, collect: their name, preferred date/time, and service needed. Confirm details before finalizing.
- If a customer wants to pay, offer to generate a payment link and ask what product/service they want to pay for.
- If the customer is upset, apologize politely and reassure them.
- If a question is unclear or incomplete, ask clarifying questions.
- If you cannot answer something, politely say you cannot and offer to connect them with an agent.
- If the customer shows buying intent, guide them to booking or payment.
- Do not provide medical, legal, or financial advice.
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