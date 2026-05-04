# ✅ WA AutoBot — Production Launch Checklist

## Week 1 — Security (DONE ✅)
- [x] Helmet.js — HTTP security headers
- [x] express-rate-limit — brute force & DDoS protection
- [x] express-mongo-sanitize — NoSQL injection prevention
- [x] xss-clean — XSS attack prevention
- [x] Strict CORS whitelist (only your frontend domain)
- [x] Password complexity validation (8+ chars, upper+lower+number)
- [x] Anti-timing-attack login (prevents user enumeration)
- [x] JWT refresh token rotation (15min access + 7day refresh)
- [x] HttpOnly cookie for refresh token
- [x] Suspended account blocking (checkActive middleware)
- [x] Body size limit (10kb max)

## Week 1 — Email System (DONE ✅)
- [x] Welcome email on registration
- [x] Password reset (15min expiry, SHA-256 hashed token)
- [x] Subscription upgrade confirmation
- [x] Subscription cancellation confirmation
- [x] Payment failed warning
- [x] AI limit warning at 80%
- [x] Payment receipt for customers
- [x] WhatsApp token expiry alert

## Week 1 — WhatsApp Token (DONE ✅)
- [x] Token health check cron (every 12 hours)
- [x] Auto-email business owner when token expires
- [x] Instructions to get permanent system user token

## Week 2 — Database (DONE ✅)
- [x] MongoDB indexes for all collections
- [x] Conversation indexes (business+phone, status, lastMessageAt)
- [x] Transaction indexes (reference unique, status, business)
- [x] Subscription indexes (business, status, currentPeriodEnd)

## Week 2 — Logging (DONE ✅)
- [x] Winston logger with levels (error/warn/info/debug)
- [x] Error log file (logs/error.log, 5MB rotate, 5 files)
- [x] Combined log file (logs/combined.log, 10MB rotate)
- [x] Request logger (method, path, status, duration, IP)
- [x] Uncaught exception + unhandled rejection handlers

## Week 2 — Production Server (DONE ✅)
- [x] Graceful shutdown (SIGTERM/SIGINT)
- [x] Compression (gzip all responses)
- [x] Trust proxy (Railway/Render/Heroku)
- [x] Global error handler middleware
- [x] 404 handler
- [x] Raw body for webhook signature verification
- [x] Idempotency check on Paystack webhooks (prevent double-processing)

## Week 2 — Subscription (DONE ✅)
- [x] Daily expiry check — downgrades expired paid plans to free
- [x] Monthly usage reset on billing cycle
- [x] 80% usage warning email (sent once per cycle)
- [x] Subscription downgrade email when period ends

## Bank Transfer (DONE ✅)
- [x] Paystack bank list API (all Nigerian banks)
- [x] Account number verification (name lookup)
- [x] Save payout bank accounts with Paystack recipient code
- [x] Generate bank-transfer-only payment links (virtual account)
- [x] Generate all-channels links (card + bank + USSD + mobile)
- [x] Payment method tracking on transactions
- [x] Payment breakdown in analytics
- [x] Bank account manager UI
- [x] Real-time account name verification UI

## Still Manual (Do These Yourself)
- [ ] Set up MongoDB Atlas automatic backup (Atlas dashboard → Backup)
- [ ] Set up UptimeRobot (uptimerobot.com) — free uptime monitoring
- [ ] Create permanent WhatsApp System User token in Meta Business Manager
- [ ] Configure Paystack recurring plans (Dashboard → Products → Plans)
- [ ] Point custom domain to Vercel + Railway
- [ ] Add SSL certificate (automatic with Vercel/Railway)

## Commands
```bash
# Install dependencies
cd backend && npm install

# Create first admin account
npm run seed:admin

# Start development
npm run dev

# Start production
npm start
```

## Deployment
```
Backend  → Railway.app (auto-detect Node.js)
Frontend → Vercel.com (auto-detect Vite)
Database → MongoDB Atlas (M0 free or M2 paid)
Email    → Resend.com (free 3,000/month)
```
