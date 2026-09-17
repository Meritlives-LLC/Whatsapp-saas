const metaRoutes = require('./metaRoutes');
const express = require('express');
const router  = express.Router();
const { protect, adminOnly, businessOnly } = require('../middlewares/auth');
const { attachSubscription } = require('../middlewares/subscription');
const {
  authLimiter, passwordResetLimiter, checkActive
} = require('../middlewares/security');

const authCtrl  = require('../controllers/authController');
const convCtrl  = require('../controllers/conversationController');
const bizCtrl   = require('../controllers/businessController');
const subCtrl   = require('../controllers/subscriptionController');
const adminCtrl = require('../controllers/adminController');
const { googleAuth, googleCallback } = require('../controllers/authController');


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
router.post('/auth/change-password',        protect, authCtrl.changePassword);

router.use('/meta', metaRoutes);

// ── PAYSTACK WEBHOOKS (raw body needed for signature check) ───────────────────
router.post('/subscription/webhook', express.raw({ type: 'application/json' }), subCtrl.paystackWebhook);
router.post('/payments/webhook',     express.raw({ type: 'application/json' }), bizCtrl.paystackWebhook);

// ── SUBSCRIPTION ──────────────────────────────────────────────────────────────
// businessOnly added below: these all key off req.user.business._id with no
// null-guard in the controller, so an account with no business (previously
// only ever an admin misusing a business route) would 500 instead of a
// clean 403. attachSubscription already no-ops safely with no business, but
// businessOnly stops the request before it even gets there.
router.get('/subscription/plans',        subCtrl.getPlans);
router.get('/subscription/history',      protect, checkActive, businessOnly, attachSubscription, subCtrl.getBillingHistory);
router.get('/subscription',              protect, checkActive, businessOnly, attachSubscription, subCtrl.getSubscription);
router.post('/subscription/upgrade',     protect, checkActive, businessOnly, attachSubscription, subCtrl.upgrade);
router.post('/subscription/verify',      protect, checkActive, businessOnly, attachSubscription, subCtrl.verifyUpgrade);
router.post('/subscription/cancel',      protect, checkActive, businessOnly, attachSubscription, subCtrl.cancel);
router.post('/subscription/reactivate',  protect, checkActive, businessOnly, attachSubscription, subCtrl.reactivate);

// ── BUSINESS ──────────────────────────────────────────────────────────────────
router.get('/business', protect, checkActive, businessOnly, bizCtrl.getBusiness);
router.put('/business', protect, checkActive, businessOnly, bizCtrl.updateBusiness);

// ── CONVERSATIONS ─────────────────────────────────────────────────────────────
router.get('/conversations',              protect, checkActive, businessOnly, convCtrl.getConversations);
router.get('/conversations/stats',        protect, checkActive, businessOnly, convCtrl.getStats);
router.get('/conversations/:id',          protect, checkActive, businessOnly, convCtrl.getConversation);
router.post('/conversations/:id/reply',   protect, checkActive, businessOnly, convCtrl.sendManualReply);
router.patch('/conversations/:id/status', protect, checkActive, businessOnly, convCtrl.updateStatus);

// ── PRODUCTS ──────────────────────────────────────────────────────────────────
router.get('/products',        protect, checkActive, businessOnly, bizCtrl.getProducts);
router.post('/products',       protect, checkActive, businessOnly, bizCtrl.createProduct);
router.put('/products/:id',    protect, checkActive, businessOnly, bizCtrl.updateProduct);
router.delete('/products/:id', protect, checkActive, businessOnly, bizCtrl.deleteProduct);

// ── APPOINTMENTS ──────────────────────────────────────────────────────────────
router.get('/appointments',       protect, checkActive, businessOnly, bizCtrl.getAppointments);
router.patch('/appointments/:id', protect, checkActive, businessOnly, bizCtrl.updateAppointment);

// ── PAYMENTS ──────────────────────────────────────────────────────────────────
router.post('/payments/create-link',         protect, checkActive, businessOnly, bizCtrl.createPaymentLink);
router.get('/payments/transactions',         protect, checkActive, businessOnly, bizCtrl.getTransactions);
router.get('/payments/banks',                protect, checkActive, businessOnly, bizCtrl.getBanks);
router.get('/payments/verify-account',       protect, checkActive, businessOnly, bizCtrl.verifyBankAccount);
router.get('/payments/bank-accounts',        protect, checkActive, businessOnly, bizCtrl.getBankAccounts);
router.post('/payments/bank-accounts',       protect, checkActive, businessOnly, bizCtrl.saveBankAccount);
router.delete('/payments/bank-accounts/:id', protect, checkActive, businessOnly, bizCtrl.deleteBankAccount);

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
router.get('/analytics', protect, checkActive, businessOnly, bizCtrl.getAnalytics);

router.get('/auth/google',          googleAuth);
router.get('/auth/google/callback', googleCallback);

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
