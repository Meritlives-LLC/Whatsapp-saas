import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Zap, CheckCircle, AlertCircle, TrendingUp, Calendar, XCircle } from 'lucide-react';
import api from '../utils/api';
import { format } from 'date-fns';


const planColors = {
  free: 'bg-gray-100 text-gray-700',
  starter: 'bg-blue-50 text-blue-700',
  growth: 'bg-green-50 text-green-700',
  pro: 'bg-purple-50 text-purple-700',
};

const planNextUp = { free: 'starter', starter: 'growth', growth: 'pro', pro: null };
const planPrices = { free: 0, starter: 8000, growth: 20000, pro: 45000 };
const planLimits = { free: 100, starter: 1000, growth: 5000, pro: 999999 };

export default function SubscriptionPage() {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Handle return from Paystack payment
    const ref = searchParams.get('ref');
    if (ref) verifyPayment(ref);
    else fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const { data } = await api.get('/subscription');
      setSub(data.data);
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (ref) => {
    try {
      await api.post('/subscription/verify', { reference: ref });
      window.history.replaceState({}, '', '/subscription');
      await fetchSubscription();
    } catch {
      await fetchSubscription();
    }
  };

  const handleUpgrade = async (planId) => {
    setUpgrading(true);
    try {
      const { data } = await api.post('/subscription/upgrade', { planId });
      window.location.href = data.data.paymentLink;
    } catch (err) {
      alert(err.response?.data?.message || 'Something went wrong');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? You keep access until the end of your billing period.')) return;
    setCancelling(true);
    try {
      const { data } = await api.post('/subscription/cancel');
      alert(data.message);
      fetchSubscription();
    } catch (err) {
      alert(err.response?.data?.message || 'Error cancelling');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const usedReplies = sub?.usage?.aiRepliesCount || 0;
  const totalReplies = planLimits[sub?.plan] || 100;
  const usagePct = totalReplies === 999999 ? 5 : Math.min((usedReplies / totalReplies) * 100, 100);
  const nextPlan = planNextUp[sub?.plan];
  const isActive = sub?.status === 'active';

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan and billing</p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${planColors[sub?.plan]}`}>
                {sub?.plan?.toUpperCase()} PLAN
              </span>
              {isActive && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle size={12} /> Active
                </span>
              )}
              {sub?.status === 'past_due' && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle size={12} /> Past due
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {sub?.plan === 'free' ? 'Free forever' : `₦${planPrices[sub?.plan]?.toLocaleString()}/month`}
            </p>
          </div>
          {sub?.plan !== 'free' && sub?.currentPeriodEnd && (
            <div className="text-right">
              <p className="text-xs text-gray-400">
                {sub?.cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'}
              </p>
              <p className="text-sm font-medium text-gray-700">
                {format(new Date(sub.currentPeriodEnd), 'MMM d, yyyy')}
              </p>
            </div>
          )}
        </div>

        {/* AI Usage Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>AI replies used this month</span>
            <span className="font-medium text-gray-700">
              {usedReplies.toLocaleString()} / {totalReplies === 999999 ? '∞' : totalReplies.toLocaleString()}
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-400' : usagePct >= 70 ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {usagePct >= 80 && totalReplies !== 999999 && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} />
              {usagePct >= 100 ? 'Limit reached — upgrade to restore AI replies' : `${Math.round(100 - usagePct)}% remaining — consider upgrading`}
            </p>
          )}
        </div>

        {/* Plan Features Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'AI replies / mo', value: totalReplies === 999999 ? 'Unlimited' : totalReplies.toLocaleString() },
            { label: 'WhatsApp numbers', value: sub?.limits?.whatsappNumbers === 999999 ? 'Unlimited' : sub?.limits?.whatsappNumbers },
            { label: 'Products', value: sub?.limits?.products === 999999 ? 'Unlimited' : sub?.limits?.products },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade CTA */}
      {nextPlan && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-green-600" />
                <span className="text-sm font-semibold text-green-800">Upgrade to {nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1)}</span>
              </div>
              <p className="text-xs text-green-700">
                {nextPlan === 'starter' && 'Get 1,000 AI replies/month + full features for ₦8,000/mo'}
                {nextPlan === 'growth' && 'Get 5,000 AI replies + 3 WhatsApp numbers for ₦20,000/mo'}
                {nextPlan === 'pro' && 'Unlimited everything — perfect for scaling agencies, ₦45,000/mo'}
              </p>
            </div>
            <button
              onClick={() => handleUpgrade(nextPlan)}
              disabled={upgrading}
              className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex-shrink-0 ml-4"
            >
              {upgrading ? 'Loading...' : `Upgrade — ₦${planPrices[nextPlan]?.toLocaleString()}/mo`}
            </button>
          </div>
        </div>
      )}

      {/* See all plans */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/pricing')}
          className="text-sm text-green-600 hover:underline flex items-center gap-1"
        >
          <Zap size={13} /> View all plans
        </button>

        {sub?.plan !== 'free' && !sub?.cancelAtPeriodEnd && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <XCircle size={13} />
            {cancelling ? 'Cancelling...' : 'Cancel subscription'}
          </button>
        )}
        {sub?.cancelAtPeriodEnd && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle size={12} />
            Cancels {sub.currentPeriodEnd ? format(new Date(sub.currentPeriodEnd), 'MMM d') : 'soon'}
          </p>
        )}
      </div>
    </div>
  );
}
