const nodemailer = require('nodemailer');
const logger = require('../config/logger');

// Create transporter
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: use SMTP (Gmail, SendGrid, Resend etc.)
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    // Development: use Ethereal (fake SMTP, no real emails sent)
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.EMAIL_USER || 'ethereal_user',
        pass: process.env.EMAIL_PASS || 'ethereal_pass',
      },
    });
  }
};

const transporter = createTransporter();

// ── Base HTML wrapper ────────────────────────────────────────────────────────
const wrap = (content, title) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: #16a34a; padding: 28px 32px; }
    .header h1 { margin: 0; color: white; font-size: 20px; font-weight: 700; }
    .header p { margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 13px; }
    .body { padding: 28px 32px; color: #374151; font-size: 14px; line-height: 1.6; }
    .body h2 { color: #111827; font-size: 18px; margin-top: 0; }
    .btn { display: inline-block; margin: 20px 0; padding: 12px 28px; background: #16a34a; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #dcfce7; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; }
    .info-value { color: #111827; font-weight: 500; }
    .footer { padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>⚡ WA AutoBot</h1>
      <p>AI WhatsApp Business Automation</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © ${new Date().getFullYear()} WA AutoBot · Nigeria<br/>
      If you didn't request this email, you can safely ignore it.
    </div>
  </div>
</body>
</html>`;

// ── Send helper ──────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"WA AutoBot" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${subject} [${info.messageId}]`);
    return info;
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    // Don't throw — email failure should never crash the main flow
  }
};

// ═══════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Welcome email after registration
 */
exports.sendWelcomeEmail = async (user, businessName) => {
  await sendEmail({
    to: user.email,
    subject: `Welcome to WA AutoBot, ${user.name}! 🎉`,
    html: wrap(`
      <h2>Welcome aboard, ${user.name}! 👋</h2>
      <p>Your account for <strong>${businessName}</strong> has been created successfully. You're on the <strong>Free plan</strong> — 100 AI replies per month to get you started.</p>

      <div class="info-box">
        <div class="info-row"><span class="info-label">Business</span><span class="info-value">${businessName}</span></div>
        <div class="info-row"><span class="info-label">Email</span><span class="info-value">${user.email}</span></div>
        <div class="info-row"><span class="info-label">Plan</span><span class="info-value">Free (100 AI replies/month)</span></div>
      </div>

      <p><strong>Next steps:</strong></p>
      <ol>
        <li>Go to <strong>Settings → WhatsApp</strong> and connect your WhatsApp number</li>
        <li>Add your products in <strong>Products</strong></li>
        <li>Customize your AI in <strong>Settings → AI Knowledge</strong></li>
        <li>When ready, upgrade your plan to unlock more AI replies</li>
      </ol>

      <a href="${process.env.FRONTEND_URL}" class="btn">Open Dashboard →</a>

      <hr class="divider"/>
      <p style="font-size:13px;color:#6b7280;">Need help? Reply to this email and we'll get back to you.</p>
    `, 'Welcome to WA AutoBot'),
  });
};

/**
 * Password reset email
 */
exports.sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your WA AutoBot password',
    html: wrap(`
      <h2>Password Reset Request</h2>
      <p>Hi ${user.name}, we received a request to reset your password.</p>
      <p>Click the button below to set a new password. This link expires in <strong>15 minutes</strong>.</p>

      <a href="${resetUrl}" class="btn">Reset Password →</a>

      <p style="font-size:13px;color:#6b7280;">Or copy this link into your browser:<br/>
      <span style="word-break:break-all;color:#16a34a;">${resetUrl}</span></p>

      <hr class="divider"/>
      <p style="font-size:13px;color:#6b7280;">If you didn't request a password reset, ignore this email. Your password won't change.</p>
    `, 'Reset Password'),
  });
};

/**
 * Subscription upgrade confirmation
 */
exports.sendUpgradeEmail = async (user, plan, amount) => {
  const planDetails = {
    starter: { replies: '1,000', price: '₦8,000' },
    growth:  { replies: '5,000', price: '₦20,000' },
    pro:     { replies: 'Unlimited', price: '₦45,000' },
  };
  const details = planDetails[plan] || {};

  await sendEmail({
    to: user.email,
    subject: `You're now on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan! 🚀`,
    html: wrap(`
      <h2>Upgrade Successful! 🎉</h2>
      <p>Hi ${user.name}, your payment was confirmed and your account has been upgraded.</p>

      <div class="info-box">
        <div class="info-row"><span class="info-label">New Plan</span><span class="info-value" style="text-transform:capitalize;">${plan}</span></div>
        <div class="info-row"><span class="info-label">AI Replies</span><span class="info-value">${details.replies}/month</span></div>
        <div class="info-row"><span class="info-label">Amount Paid</span><span class="info-value">₦${amount?.toLocaleString() || details.price}</span></div>
        <div class="info-row"><span class="info-label">Next Billing</span><span class="info-value">In 30 days (auto-renews)</span></div>
      </div>

      <a href="${process.env.FRONTEND_URL}/subscription" class="btn">View Subscription →</a>
    `, 'Upgrade Confirmed'),
  });
};

/**
 * Subscription cancellation confirmation
 */
exports.sendCancellationEmail = async (user, plan, periodEnd) => {
  await sendEmail({
    to: user.email,
    subject: 'Your WA AutoBot subscription has been cancelled',
    html: wrap(`
      <h2>Subscription Cancelled</h2>
      <p>Hi ${user.name}, your <strong>${plan}</strong> subscription has been cancelled.</p>

      <div class="info-box">
        <div class="info-row"><span class="info-label">Access Until</span><span class="info-value">${new Date(periodEnd).toLocaleDateString('en-NG', { day:'numeric', month:'long', year:'numeric' })}</span></div>
        <div class="info-row"><span class="info-label">After That</span><span class="info-value">Moved to Free plan (100 replies/month)</span></div>
      </div>

      <p>You can re-subscribe at any time from your dashboard.</p>
      <a href="${process.env.FRONTEND_URL}/subscription" class="btn">Reactivate Subscription →</a>

      <p style="font-size:13px;color:#6b7280;">We're sorry to see you go. If there's anything we can improve, reply to this email.</p>
    `, 'Subscription Cancelled'),
  });
};

/**
 * Payment failed / past due warning
 */
exports.sendPaymentFailedEmail = async (user, plan) => {
  await sendEmail({
    to: user.email,
    subject: '⚠️ Payment failed — action required',
    html: wrap(`
      <h2>Payment Failed</h2>
      <p>Hi ${user.name}, we couldn't process your payment for the <strong>${plan}</strong> plan.</p>

      <p>Your account has been marked as past-due. Please update your payment method to avoid losing access to your AI automation.</p>

      <a href="${process.env.FRONTEND_URL}/subscription" class="btn">Update Payment →</a>

      <hr class="divider"/>
      <p style="font-size:13px;color:#6b7280;">If you believe this is a mistake, please contact your bank or reply to this email.</p>
    `, 'Payment Failed'),
  });
};

/**
 * AI limit warning at 80%
 */
exports.sendLimitWarningEmail = async (user, used, limit) => {
  await sendEmail({
    to: user.email,
    subject: '⚡ You\'re running low on AI replies',
    html: wrap(`
      <h2>AI Reply Limit Warning</h2>
      <p>Hi ${user.name}, you've used <strong>${used}</strong> of your <strong>${limit}</strong> monthly AI replies.</p>
      <p>When you hit 100%, AI replies will pause and customers will receive a fallback message.</p>

      <a href="${process.env.FRONTEND_URL}/subscription" class="btn">Upgrade Now →</a>

      <p style="font-size:13px;color:#6b7280;">Your usage resets on the 1st of next month.</p>
    `, 'AI Limit Warning'),
  });
};

/**
 * Payment receipt email
 */
exports.sendPaymentReceiptEmail = async (customer, amount, reference, businessName) => {
  await sendEmail({
    to: customer.email,
    subject: `Payment confirmed — ₦${amount.toLocaleString()} receipt`,
    html: wrap(`
      <h2>Payment Confirmed ✅</h2>
      <p>Hi ${customer.name || 'there'}, your payment to <strong>${businessName}</strong> was successful.</p>

      <div class="info-box">
        <div class="info-row"><span class="info-label">Amount</span><span class="info-value">₦${amount.toLocaleString()}</span></div>
        <div class="info-row"><span class="info-label">Reference</span><span class="info-value" style="font-family:monospace;font-size:12px">${reference}</span></div>
        <div class="info-row"><span class="info-label">Business</span><span class="info-value">${businessName}</span></div>
        <div class="info-row"><span class="info-label">Date</span><span class="info-value">${new Date().toLocaleDateString('en-NG', { day:'numeric', month:'long', year:'numeric' })}</span></div>
      </div>

      <p>Keep this email as your receipt. If you have questions, contact ${businessName} directly.</p>
    `, 'Payment Receipt'),
  });
};

// Export sendEmail for use in other services
exports.sendEmail = sendEmail;
