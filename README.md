# 🤖 WA AutoBot — AI WhatsApp Business Automation SaaS

A full-stack production-ready SaaS platform where businesses connect their WhatsApp number, and an AI automatically handles customer conversations, bookings, payments, and lead capture.

---

## 🗂️ Folder Structure

```
whatsapp-saas/
├── backend/
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js      # Register / Login / Me
│   │   ├── webhookController.js   # WhatsApp webhook handler
│   │   ├── conversationController.js
│   │   └── businessController.js  # Products, Appointments, Payments, Analytics
│   ├── middlewares/
│   │   └── auth.js                # JWT protect, adminOnly, businessOnly
│   ├── models/
│   │   ├── User.js
│   │   ├── Business.js
│   │   ├── Conversation.js        # Includes embedded Message schema
│   │   └── index.js               # Product, Appointment, Transaction
│   ├── routes/
│   │   └── index.js               # All API routes
│   ├── services/
│   │   ├── openaiService.js       # AI reply generation + lead extraction
│   │   ├── whatsappService.js     # Send/receive WhatsApp messages
│   │   ├── paystackService.js     # Payment links + webhook verification
│   │   └── cronService.js         # Follow-ups + appointment reminders
│   ├── .env.example
│   ├── package.json
│   └── server.js                  # Express + Socket.io entry
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Layout.jsx         # Sidebar + main wrapper
    │   ├── context/
    │   │   └── AuthContext.jsx    # Auth state + login/register/logout
    │   ├── hooks/
    │   │   └── useSocket.js       # Real-time WhatsApp message hook
    │   ├── pages/
    │   │   ├── AuthPage.jsx       # Login & Register
    │   │   ├── Dashboard.jsx      # Analytics overview
    │   │   ├── Conversations.jsx  # WhatsApp-style chat UI
    │   │   ├── Products.jsx       # Product catalog management
    │   │   ├── BookingsPayments.jsx  # Bookings + Paystack
    │   │   ├── Analytics.jsx      # Charts & KPIs
    │   │   └── Settings.jsx       # Business + AI + WhatsApp config
    │   ├── utils/
    │   │   └── api.js             # Axios with JWT interceptors
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## ⚙️ Local Setup

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Backend Environment

```bash
cp backend/.env.example backend/.env
# Fill in all variables (see below)
```

### 3. Run Locally

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Frontend: http://localhost:3000  
Backend API: http://localhost:5000

---

## 🔐 Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random secret string for JWT signing |
| `DEEPSEEK_API_KEY` | From platform.deepseek.com |
| `WHATSAPP_ACCESS_TOKEN` | From Meta for Developers |
| `WHATSAPP_VERIFY_TOKEN` | Your custom string (you set this) |
| `WHATSAPP_PHONE_NUMBER_ID` | From Meta WhatsApp API Setup page |
| `PAYSTACK_SECRET_KEY` | From Paystack dashboard → Settings → API |
| `FRONTEND_URL` | Your deployed frontend URL |
| `PORT` | Server port (default 5000) |

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user + business |
| POST | `/api/auth/login` | Login, get JWT token |
| GET  | `/api/auth/me` | Get current user (protected) |

### WhatsApp Webhook
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/webhook` | Meta webhook verification |
| POST | `/api/webhook` | Receive incoming messages |

### Business
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/business` | Get business details |
| PUT  | `/api/business` | Update business settings |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/conversations` | List conversations (`?status=open&page=1`) |
| GET  | `/api/conversations/stats` | Counts by status |
| GET  | `/api/conversations/:id` | Get conversation + messages |
| POST | `/api/conversations/:id/reply` | Send manual reply |
| PATCH | `/api/conversations/:id/status` | Update status |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/products` | List all products |
| POST   | `/api/products` | Create product |
| PUT    | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

### Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET   | `/api/appointments` | List appointments |
| PATCH | `/api/appointments/:id` | Update status |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/create-link` | Generate Paystack link |
| GET  | `/api/payments/transactions` | List transactions |
| POST | `/api/payments/webhook` | Paystack webhook |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics` | Dashboard stats |

---

## 🌍 Deployment

### Backend → Railway

1. Create account at railway.app
2. New project → Deploy from GitHub
3. Add all environment variables in Railway dashboard
4. Railway auto-detects Node.js and deploys
5. Copy your Railway URL (e.g. `https://your-app.up.railway.app`)

### Frontend → Vercel

1. Push frontend to GitHub
2. Import on vercel.com
3. Set Framework: Vite
4. Add environment variable:
   - `VITE_API_URL` = your Railway backend URL
5. In `vite.config.js`, update proxy or use full URL

### Database → MongoDB Atlas

1. Create free cluster at mongodb.com/atlas
2. Create database user
3. Whitelist `0.0.0.0/0` (all IPs) for Railway
4. Copy connection string to `MONGODB_URI`

### WhatsApp Webhook Setup (Meta for Developers)

1. Go to developers.facebook.com
2. Create/open your app → WhatsApp → Configuration
3. Set Webhook URL: `https://your-backend.railway.app/api/webhook`
4. Set Verify Token: same value as your `WHATSAPP_VERIFY_TOKEN`
5. Subscribe to: `messages`
6. Copy your Phone Number ID and Access Token to `.env`

### Paystack Webhook Setup

1. Go to dashboard.paystack.com → Settings → API Keys & Webhooks
2. Set webhook URL: `https://your-backend.railway.app/api/payments/webhook`
3. Copy secret key to `PAYSTACK_SECRET_KEY`

---

## 📝 Example API Requests

### Register
```json
POST /api/auth/register
{
  "name": "Samuel Obi",
  "email": "samuel@example.com",
  "password": "secret123",
  "businessName": "Obi Pet Store"
}
```

### Send Manual Reply
```json
POST /api/conversations/64abc123.../reply
Authorization: Bearer <token>
{
  "message": "Hello! Your order has been confirmed."
}
```

### Generate Payment Link
```json
POST /api/payments/create-link
Authorization: Bearer <token>
{
  "customerEmail": "customer@gmail.com",
  "customerName": "John Doe",
  "amount": 5000
}
```

---

## 🔄 How the AI Flow Works

```
Customer sends WhatsApp message
        ↓
Meta sends POST to /api/webhook
        ↓
Find business by Phone Number ID
        ↓
Load or create Conversation
        ↓
Save inbound message
        ↓
Send to OpenAI with business context + chat history
        ↓
Get AI reply
        ↓
Send reply via WhatsApp Cloud API
        ↓
Save outbound message
        ↓
Emit real-time update via Socket.io
        ↓
Dashboard updates live
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Frontend | React 18 + Vite |
| Styling | TailwindCSS |
| Realtime | Socket.io |
| AI | DeepSeek Chat (`deepseek-chat`) |
| WhatsApp | Meta Cloud API |
| Payments | Paystack |
| Charts | Recharts |
| Scheduling | node-cron |
| Auth | JWT + bcrypt |

---

## ✅ Features Checklist

- [x] Multi-tenant: each business isolated
- [x] AI replies using GPT-4o-mini + business knowledge
- [x] Conversation CRM with status management
- [x] Manual reply from dashboard
- [x] Real-time chat updates via Socket.io
- [x] Lead detection and capture
- [x] Product catalog (AI-aware)
- [x] Appointment booking system
- [x] Paystack payment links
- [x] Paystack webhook verification
- [x] Analytics dashboard
- [x] Auto follow-up cron job
- [x] Appointment reminder cron job
- [x] JWT authentication
- [x] Role-based access control
- [x] Clean, modular code structure
