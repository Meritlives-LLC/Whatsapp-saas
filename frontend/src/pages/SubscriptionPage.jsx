// SubscriptionPage.jsx — compact billing overview at /subscription/manage
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Zap, CheckCircle, AlertCircle, TrendingUp, XCircle, RotateCcw, RefreshCw, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import api from '../utils/api';

const planColors = {
  free: 'bg-gray-100 text-gray-700',
  starter: 'bg-blue-50 text-blue-700',
  growth: 'bg-green-50 text-green-700',
  pro: 'bg-purple-50 text-purple-700',
};

export default function SubscriptionPage() {
  const [sub, setSub]             = useState(null);
  const [plans, setPlans]         = useState({});
  const [currSym, setCurrSym]     = useState('₦');
  const [loading, setLoading]     = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling]     = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [msg, setMsg]             = useState(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) verifyPayment(ref);
    else loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subRes, plansRes] = await Promise.all([
        api.get('/subscription'),
        api.get('/subscription/plans'),
      ]);
      setSub(subRes.data.data);
      setPlans(plansRes.data.data);
      const sym = Object.values(plansRes.data.data).find(p => p.currencySymbol)?.currencySymbol || '₦';
      setCurrSym(sym);
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (ref) => {
    try {
      await api.post('/subscription/verify', { reference: ref });
      window.history.replaceState({}, '', '/subscription/manage');
      setMsg({ type: 'success', text: '🎉 Payment confirmed! Your plan has been upgraded.' });
    } catch { /* webhook already handled it */ }
    await loadData();
  };

  const handleUpgrade = async (planId) => {
    setUpgrading(true);
    try {
      const { data } = await api.post('/subscription/upgrade', { planId });
      window.location.href = data.data.paymentLink;
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Something went wrong' });
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await api.post('/subscription/cancel');
      setMsg({ type: 'info', text: data.message });
      setConfirmCancel(false);
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Error cancelling' });
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      const { data } = await api.post('/subscription/reactivate');
      setMsg({ type: 'success', text: data.message });
      await loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Reactivation failed. Contact support.' });
    } finally {
      setReactivating(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const planOrder   = ['free', 'starter', 'growth', 'pro'];
  const currentIdx  = planOrder.indexOf(sub?.plan || 'free');
  const nextPlanId  = planOrder[currentIdx + 1] || null;
  const nextPlan    = nextPlanId ? plans[nextPlanId] : null;

  const usedReplies  = sub?.usage?.aiRepliesCount || 0;
  const totalReplies = sub?.limits?.aiRepliesPerMonth ?? plans[sub?.plan]?.limits?.aiRepliesPerMonth ?? 100;
  const isUnlimited  = totalReplies >= 999999;
  const usagePct     = isUnlimited ? 5 : Math.min((usedReplies / totalReplies) * 100, 100);
  const isActive     = sub?.status === 'active';

  // Reset date
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });

  const formatPrice = (plan) => {
    if (!plan || plan.price === 0) return 'Free forever';
    const amount = plan.displayPrice ?? plan.price;
    return `${currSym}${amount.toLocaleString()}/month`;
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan and billing</p>
      </div>

      {msg && (
        <div className={`mb-5 flex items-start gap-3 p-4 rounded-xl text-sm font-medium ${
          msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          msg.type === 'error'   ? 'bg-red-50 text-red-600 border border-red-200' :
                                   'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Current Plan Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${planColors[sub?.plan] || planColors.free}`}>
                {(sub?.plan || 'free').toUpperCase()} PLAN
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
              {sub?.cancelAtPeriodEnd && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle size={12} /> Cancelling
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatPrice(plans[sub?.plan])}
            </p>
          </div>
          {sub?.plan !== 'free' && sub?.currentPeriodEnd && (
            <div className="text-right">
              <p className="text-xs text-gray-400">
                {sub?.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
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
              {usedReplies.toLocaleString()} / {isUnlimited ? '∞' : totalReplies.toLocaleString()}
              {!isUnlimited && <span className="text-gray-400 ml-1">· resets {resetDate}</span>}
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-400' : usagePct >= 70 ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {usagePct >= 80 && !isUnlimited && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} />
              {usagePct >= 100 ? 'Limit reached — upgrade to restore AI replies' : `${Math.round(100 - usagePct)}% remaining — consider upgrading`}
            </p>
          )}
        </div>

        {/* Plan limits */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'AI replies / mo',  value: isUnlimited ? 'Unlimited' : totalReplies.toLocaleString() },
            { label: 'WhatsApp numbers', value: sub?.limits?.whatsappNumbers >= 999999 ? 'Unlimited' : sub?.limits?.whatsappNumbers ?? '—' },
            { label: 'Products',         value: sub?.limits?.products >= 999999 ? 'Unlimited' : sub?.limits?.products ?? '—' },
            { label: 'Team members',     value: sub?.limits?.teamMembers >= 999999 ? 'Unlimited' : sub?.limits?.teamMembers ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-base font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Next-plan upgrade CTA */}
      {nextPlan && !sub?.cancelAtPeriodEnd && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-green-600" />
                <span className="text-sm font-semibold text-green-800">
                  Upgrade to {nextPlan.name}
                </span>
              </div>
              <p className="text-xs text-green-700">
                {nextPlan.features?.[0]} — {formatPrice(nextPlan)}
              </p>
            </div>
            <button
              onClick={() => handleUpgrade(nextPlanId)}
              disabled={upgrading}
              className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex-shrink-0 flex items-center gap-1.5"
            >
              {upgrading ? (
                <><RefreshCw size={13} className="animate-spin" /> Loading...</>
              ) : (
                <><ArrowRight size={13} /> Upgrade — {formatPrice(nextPlan)}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between">
        <Link
          to="/subscription"
          className="text-sm text-green-600 hover:underline flex items-center gap-1"
        >
          <Zap size={13} /> View all plans & billing
        </Link>

      {sub?.plan !== 'free' && (
        sub?.cancelAtPeriodEnd ? (
          <button
            onClick={handleReactivate}
            disabled={reactivating}
            className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors flex items-center gap-1"
          >
            <RotateCcw size={13} />
            {reactivating ? 'Reactivating...' : 'Resume subscription'}
          </button>
        ) : confirmCancel ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex flex-col gap-2">
            <p className="text-xs font-semibold text-red-700">Cancel subscription?</p>
            <p className="text-xs text-red-400">Access continues until end of billing period. No refund for partial months.</p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Yes, cancel'}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50"
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmCancel(true)}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <XCircle size={13} />
            Cancel subscription
          </button>
        )
      )}
      </div>
    </div>
  );
}
