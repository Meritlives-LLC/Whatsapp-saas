const metaRoutes = require('./metaRoutes');
const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middlewares/auth');
const { attachSubscription } = require('../middlewares/subscription');
const {
  authLimiter, passwordResetLimiter, checkActive
} = require('../middlewares/security');

const authCtrl  = require('../controllers/authController');
const convCtrl  = require('../controllers/conversationController');
const bizCtrl   = require('../controllers/businessController');
const subCtrl   = require('../controllers/subscriptionController');
const adminCtrl = require('../controllers/adminController');


// NOTE: /api/webhook GET and POST are registered directly in server.js
// BEFORE all middleware so Meta's verification is never blocked.
// Do NOT add webhook routes here.

// ── AUTH ──────────────────────────────────────────────────────────────────────
router.post('/auth/register',               authLimiter, authCtrl.register);
router.post('/auth/login',                  authLimiter, authCtrl.login);
router.post('/auth/refresh',                authCtrl.refreshToken);
router.post('/auth/logout',                 authCtrl.logout);
router.get('/auth/me',                      protect, checkActive, authCtrl.getMe);
router.post('/auth/forgot-password',        passwordResetLimiter, authCtrl.forgotPassword);
router.patch('/auth/reset-password/:token', authCtrl.resetPassword);

router.use('/meta', metaRoutes);

// ── PAYSTACK WEBHOOKS (raw body needed for signature check) ───────────────────
router.post('/subscription/webhook', express.raw({ type: 'application/json' }), subCtrl.paystackWebhook);
router.post('/payments/webhook',     express.raw({ type: 'application/json' }), bizCtrl.paystackWebhook);

// ── SUBSCRIPTION ──────────────────────────────────────────────────────────────
router.get('/subscription/plans',    subCtrl.getPlans);
router.get('/subscription',          protect, checkActive, attachSubscription, subCtrl.getSubscription);
router.post('/subscription/upgrade', protect, checkActive, attachSubscription, subCtrl.upgrade);
router.post('/subscription/verify',  protect, checkActive, attachSubscription, subCtrl.verifyUpgrade);
router.post('/subscription/cancel',  protect, checkActive, attachSubscription, subCtrl.cancel);

// ── BUSINESS ──────────────────────────────────────────────────────────────────
router.get('/business', protect, checkActive, bizCtrl.getBusiness);
router.put('/business', protect, checkActive, bizCtrl.updateBusiness);

// ── CONVERSATIONS ─────────────────────────────────────────────────────────────
router.get('/conversations',              protect, checkActive, convCtrl.getConversations);
router.get('/conversations/stats',        protect, checkActive, convCtrl.getStats);
router.get('/conversations/:id',          protect, checkActive, convCtrl.getConversation);
router.post('/conversations/:id/reply',   protect, checkActive, convCtrl.sendManualReply);
router.patch('/conversations/:id/status', protect, checkActive, convCtrl.updateStatus);

// ── PRODUCTS ──────────────────────────────────────────────────────────────────
router.get('/products',        protect, checkActive, bizCtrl.getProducts);
router.post('/products',       protect, checkActive, bizCtrl.createProduct);
router.put('/products/:id',    protect, checkActive, bizCtrl.updateProduct);
router.delete('/products/:id', protect, checkActive, bizCtrl.deleteProduct);

// ── APPOINTMENTS ──────────────────────────────────────────────────────────────
router.get('/appointments',       protect, checkActive, bizCtrl.getAppointments);
router.patch('/appointments/:id', protect, checkActive, bizCtrl.updateAppointment);

// ── PAYMENTS ──────────────────────────────────────────────────────────────────
router.post('/payments/create-link',         protect, checkActive, bizCtrl.createPaymentLink);
router.get('/payments/transactions',         protect, checkActive, bizCtrl.getTransactions);
router.get('/payments/banks',                protect, checkActive, bizCtrl.getBanks);
router.get('/payments/verify-account',       protect, checkActive, bizCtrl.verifyBankAccount);
router.get('/payments/bank-accounts',        protect, checkActive, bizCtrl.getBankAccounts);
router.post('/payments/bank-accounts',       protect, checkActive, bizCtrl.saveBankAccount);
router.delete('/payments/bank-accounts/:id', protect, checkActive, bizCtrl.deleteBankAccount);

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
router.get('/analytics', protect, checkActive, bizCtrl.getAnalytics);

// ── ADMIN ─────────────────────────────────────────────────────────────────────
router.get('/admin/stats',                    protect, adminOnly, adminCtrl.getStats);
router.get('/admin/activity',                 protect, adminOnly, adminCtrl.getActivity);
router.get('/admin/revenue',                  protect, adminOnly, adminCtrl.getRevenue);
router.get('/admin/businesses',               protect, adminOnly, adminCtrl.getBusinesses);
router.get('/admin/businesses/:id',           protect, adminOnly, adminCtrl.getBusiness);
router.patch('/admin/businesses/:id/suspend', protect, adminOnly, adminCtrl.toggleSuspend);
router.delete('/admin/businesses/:id',        protect, adminOnly, adminCtrl.deleteUser);
router.patch('/admin/businesses/:id/plan',    protect, adminOnly, adminCtrl.overridePlan);
router.patch('/admin/businesses/:id/credits', protect, adminOnly, adminCtrl.addAiCredits);
router.post('/admin/create-admin',            protect, adminOnly, adminCtrl.createAdmin);

module.exports = router;
