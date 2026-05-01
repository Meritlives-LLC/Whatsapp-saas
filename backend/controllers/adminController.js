const User = require('../models/User');
const Business = require('../models/Business');
const Subscription = require('../models/Subscription');
const Conversation = require('../models/Conversation');
const { Transaction } = require('../models/index');
const { getPlan, PLANS } = require('../config/plans');
const bcrypt = require('bcryptjs');

// ─── PLATFORM OVERVIEW ───────────────────────────────────────────────────────

exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalBusinesses,
      activeThisMonth,
      newThisMonth,
      newLastMonth,
      subBreakdown,
      totalRevenue,
      revenueThisMonth,
      totalConversations,
      totalAiReplies,
      pastDue,
    ] = await Promise.all([
      User.countDocuments({ role: 'business' }),
      User.countDocuments({ role: 'business', updatedAt: { $gte: startOfMonth } }),
      User.countDocuments({ role: 'business', createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ role: 'business', createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
      Subscription.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } }
      ]),
      Subscription.aggregate([
        { $group: { _id: null, total: { $sum: '$lastPaymentAmount' } } }
      ]),
      Subscription.aggregate([
        { $match: { lastPaymentAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$lastPaymentAmount' } } }
      ]),
      Conversation.countDocuments(),
      Subscription.aggregate([
        { $group: { _id: null, total: { $sum: '$usage.aiRepliesCount' } } }
      ]),
      Subscription.countDocuments({ status: 'past_due' }),
    ]);

    // Build plan breakdown map
    const planCounts = { free: 0, starter: 0, growth: 0, pro: 0 };
    subBreakdown.forEach(({ _id, count }) => { if (_id in planCounts) planCounts[_id] = count; });

    // MRR calculation
    const mrr =
      (planCounts.starter * PLANS.starter.price) +
      (planCounts.growth  * PLANS.growth.price)  +
      (planCounts.pro     * PLANS.pro.price);

    const growth = newLastMonth > 0
      ? (((newThisMonth - newLastMonth) / newLastMonth) * 100).toFixed(1)
      : newThisMonth > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        totalBusinesses,
        newThisMonth,
        growthPercent: Number(growth),
        planBreakdown: planCounts,
        mrr,
        totalRevenue: totalRevenue[0]?.total || 0,
        revenueThisMonth: revenueThisMonth[0]?.total || 0,
        totalConversations,
        totalAiReplies: totalAiReplies[0]?.total || 0,
        pastDueAccounts: pastDue,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── BUSINESSES ──────────────────────────────────────────────────────────────

exports.getBusinesses = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', plan = '', status = '' } = req.query;

    // Build user filter
    const userFilter = { role: 'business' };
    if (search) {
      userFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'suspended') userFilter.isActive = false;
    if (status === 'active') userFilter.isActive = true;

    const users = await User.find(userFilter)
      .populate('business')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-password');

    const total = await User.countDocuments(userFilter);

    // Attach subscriptions
    const businessIds = users.map(u => u.business?._id).filter(Boolean);
    const subscriptions = await Subscription.find({ business: { $in: businessIds } });
    const subMap = {};
    subscriptions.forEach(s => { subMap[s.business.toString()] = s; });

    // Filter by plan if requested
    let results = users.map(u => ({
      ...u.toObject(),
      subscription: u.business ? subMap[u.business._id?.toString()] || { plan: 'free' } : { plan: 'free' },
    }));

    if (plan) results = results.filter(r => r.subscription.plan === plan);

    res.json({
      success: true,
      data: results,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBusiness = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('business').select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const subscription = user.business
      ? await Subscription.findOne({ business: user.business._id })
      : null;

    const convStats = user.business
      ? await Conversation.aggregate([
          { $match: { business: user.business._id } },
          { $group: {
              _id: null,
              total: { $sum: 1 },
              open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
              leads: { $sum: { $cond: ['$isLead', 1, 0] } },
          }},
        ])
      : [];

    res.json({
      success: true,
      data: {
        user: user.toObject(),
        business: user.business,
        subscription,
        stats: convStats[0] || { total: 0, open: 0, leads: 0 },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SUSPEND / ACTIVATE ──────────────────────────────────────────────────────

exports.toggleSuspend = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot suspend admin' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `Account ${user.isActive ? 'activated' : 'suspended'}`,
      isActive: user.isActive,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot delete admin' });

    // Clean up related data
    if (user.business) {
      await Promise.all([
        Conversation.deleteMany({ business: user.business }),
        Subscription.deleteOne({ business: user.business }),
        Business.findByIdAndDelete(user.business),
      ]);
    }
    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Account and all data deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SUBSCRIPTION OVERRIDES ──────────────────────────────────────────────────

exports.overridePlan = async (req, res) => {
  try {
    const { plan, durationDays = 30 } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ success: false, message: 'Invalid plan' });

    const user = await User.findById(req.params.id).populate('business');
    if (!user?.business) return res.status(404).json({ success: false, message: 'Business not found' });

    const now = new Date();
    const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const sub = await Subscription.findOneAndUpdate(
      { business: user.business._id },
      {
        plan,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Plan changed to ${plan} for ${durationDays} days`,
      data: sub,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addAiCredits = async (req, res) => {
  try {
    const { credits } = req.body;
    if (!credits || credits < 1) return res.status(400).json({ success: false, message: 'Invalid credits amount' });

    const user = await User.findById(req.params.id).populate('business');
    if (!user?.business) return res.status(404).json({ success: false, message: 'Business not found' });

    const sub = await Subscription.findOne({ business: user.business._id });
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    // Subtract from usage count (effectively adding credits)
    sub.usage.aiRepliesCount = Math.max(0, sub.usage.aiRepliesCount - Number(credits));
    await sub.save();

    res.json({
      success: true,
      message: `Added ${credits} AI credits to ${user.name}'s account`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── REVENUE ─────────────────────────────────────────────────────────────────

exports.getRevenue = async (req, res) => {
  try {
    // Monthly revenue for last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0),
      });
    }

    const revenueByMonth = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const result = await Subscription.aggregate([
          { $match: { lastPaymentAt: { $gte: start, $lte: end }, lastPaymentAmount: { $gt: 0 } } },
          { $group: { _id: null, total: { $sum: '$lastPaymentAmount' }, count: { $sum: 1 } } },
        ]);
        return { month: label, revenue: result[0]?.total || 0, payments: result[0]?.count || 0 };
      })
    );

    // Top paying businesses
    const topBusinesses = await Subscription.find({ lastPaymentAmount: { $gt: 0 } })
      .sort({ lastPaymentAmount: -1 })
      .limit(10)
      .populate({ path: 'business', populate: { path: 'owner', select: 'name email' } });

    res.json({
      success: true,
      data: { revenueByMonth, topBusinesses },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CREATE ADMIN ────────────────────────────────────────────────────────────

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'Email already exists' });

    const admin = await User.create({ name, email, password, role: 'admin' });
    res.status(201).json({
      success: true,
      message: 'Admin account created',
      data: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── RECENT ACTIVITY ─────────────────────────────────────────────────────────

exports.getActivity = async (req, res) => {
  try {
    const [recentUsers, recentConvs, pastDue] = await Promise.all([
      User.find({ role: 'business' }).sort({ createdAt: -1 }).limit(8).select('name email createdAt isActive'),
      Conversation.find().sort({ createdAt: -1 }).limit(8)
        .populate('business', 'name')
        .select('customerName customerPhone business createdAt status'),
      Subscription.find({ status: 'past_due' })
        .populate({ path: 'business', populate: { path: 'owner', select: 'name email' } })
        .limit(5),
    ]);

    res.json({ success: true, data: { recentUsers, recentConvs, pastDue } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
