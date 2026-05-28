export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <section className="space-y-6 text-gray-600 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">1. Introduction</h2>
          <p>WA Autobot ("we", "our", "us") operates a WhatsApp Business automation platform. This Privacy Policy explains how we collect, use, and protect your information when you use our service.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Business name, email address, and account credentials</li>
            <li>WhatsApp Business account details and phone number</li>
            <li>Customer conversation data processed through your WhatsApp number</li>
            <li>Product and service information you add to the platform</li>
            <li>Payment information processed through Paystack</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide and operate the WhatsApp automation service</li>
            <li>To generate AI-powered replies to your customers</li>
            <li>To process payments and manage subscriptions</li>
            <li>To send service-related notifications and updates</li>
            <li>To improve our platform and services</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">4. WhatsApp & Meta Data</h2>
          <p>We access your WhatsApp Business account through the Meta WhatsApp Business API. We only request permissions necessary to send and receive messages on your behalf. We do not sell your WhatsApp data to third parties.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">5. Data Storage & Security</h2>
          <p>Your data is stored securely on encrypted servers. We implement industry-standard security measures to protect your information from unauthorized access, alteration, or disclosure.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">6. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li><strong>Meta / WhatsApp Business API</strong> — message delivery</li>
            <li><strong>Paystack</strong> — payment processing</li>
            <li><strong>DeepSeek / OpenAI</strong> — AI message generation</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">7. Data Retention</h2>
          <p>We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">8. Your Rights</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for data processing at any time</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">9. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, contact us at:</p>
          <p className="mt-1"><strong>Email:</strong> sales@meritlives.com</p>
        </div>
      </section>
    </div>
  );
}