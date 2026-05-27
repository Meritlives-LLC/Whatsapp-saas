import { useState, useEffect } from 'react';
import { Check, TrendingUp, Crown, ArrowRight, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import logo from '../assets/logo.svg';

const LogoIcon = ({ size = 16 }) => (
  <img src={logo} alt="logo" style={{ width: size, height: size }} className="object-contain" />
);

const PLAN_ICONS = { free: LogoIcon, starter: TrendingUp, growth: TrendingUp, pro: Crown };
const PLAN_COLORS = {
  free:    { bg: 'bg-gray-50',    text: 'text-gray-700',   btn: 'bg-gray-800 hover:bg-gray-900',    badge: '' },
  starter: { bg: 'bg-blue-50',   text: 'text-blue-700',   btn: 'bg-blue-600 hover:bg-blue-700',    badge: '' },
  growth:  { bg: 'bg-green-50',  text: 'text-green-700',  btn: 'bg-green-600 hover:bg-green-700',  badge: 'Most popular' },
  pro:     { bg: 'bg-purple-50', text: 'text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700', badge: 'Best value' },
};

export default function Subscription() {
  const [sub, setSub]           = useState(null);
  const [plans, setPlans]       = useState({});
  const [loading, setLoading]   = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg]           = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/subscription'),
      api.get('/subscription/plans'),
    ]).then(([subRes, plansRes]) => {
      setSub(subRes.data.data);
      setPlans(plansRes.data.data);
    }).finally(() => setLoading(false));

    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      api.post('/subscription/verify', { reference: ref })
        .then(() => {
          setMsg({ type: 'success', text: '🎉 Payment confirmed! Your plan has been upgraded.' });
          window.history.replaceState({}, '', '/subscription');
          return api.get('/subscription');
        })
        .then(res => setSub(res.data.data))
        .catch(() => setMsg({ type: 'error', text: 'Payment verification failed. Contact support.' }));
    }
  }, []);

  const handleUpgrade = async (planId) => {
    setUpgrading(planId);
    try {
      const { data } = await api.post('/subscription/upgrade', { planId });
      window.location.href = data.data.paymentLink;
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Upgrade failed. Try again.' });
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel subscription? You keep access until the end of the billing period.')) return;
    setCancelling(true);
    try {
      const { data } = await api.post('/subscription/cancel');
      setMsg({ type: 'info', text: data.message });
      const res = await api.get('/subscription');
      setSub(res.data.data);
    } catch (err) {
      setMsg({ type: 'error', text: 'Cancellation failed. Contact support.' });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const currentPlan  = sub?.plan || 'free';
  const usageCount   = sub?.usage?.aiRepliesCount || 0;
  const usageLimit   = sub?.limits?.aiRepliesPerMonth || 100;
  const isUnlimited  = usageLimit >= 999999;
  const usagePercent = isUnlimited ? 0 : Math.min(100, Math.round((usageCount / usageLimit) * 100));
  const nearLimit    = usagePercent >= 80;
  const atLimit      = usagePercent >= 100;
  const planOrder    = ['free', 'starter', 'growth', 'pro'];

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Subscription & Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your plan and track AI usage</p>
      </div>

      {msg && (
        <div className={`mb-6 flex items-start gap-3 p-4 rounded-xl text-sm font-medium ${
          msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          msg.type === 'error'   ? 'bg-red-50 text-red-600 border border-red-200' :
                                   'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {msg.type === 'success' ? <Check size={16} className="mt-0.5 flex-shrink-0" /> :
           msg.type === 'error'   ? <XCircle size={16} className="mt-0.5 flex-shrink-0" /> :
                                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />}
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Current plan + usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-8 md:mb-10">

        {/* Plan card */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="flex items-start justify-between mb-4 md:mb-5">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Current plan</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl md:text-2xl font-bold text-gray-900 capitalize">{currentPlan}</span>
                {currentPlan !== 'free' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    {sub?.status === 'active' ? 'Active' : sub?.status}
                  </span>
                )}
                {sub?.cancelAtPeriodEnd && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    Cancels {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </span>
                )}
              </div>
              {currentPlan !== 'free' && sub?.currentPeriodEnd && (
                <p className="text-xs text-gray-400 mt-1">
                  Next billing: {new Date(sub.currentPeriodEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className={`text-xl md:text-2xl font-bold ${currentPlan === 'free' ? 'text-gray-900' : 'text-green-600'}`}>
              {currentPlan === 'free' ? 'Free' : `₦${(plans[currentPlan]?.price || 0).toLocaleString()}/mo`}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(plans[currentPlan]?.features || []).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <Check size={13} className="text-green-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {currentPlan !== 'free' && !sub?.cancelAtPeriodEnd && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <XCircle size={12} />
                {cancelling ? 'Cancelling...' : 'Cancel subscription'}
              </button>
            </div>
          )}
        </div>

        {/* Usage meter */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 md:p-6 flex flex-col">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">AI replies this month</p>
          <div className="flex-1 flex flex-col justify-center">
            <div className="relative w-28 h-28 mx-auto mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={atLimit ? '#ef4444' : nearLimit ? '#f59e0b' : '#22c55e'}
                  strokeWidth="10"
                  strokeDasharray={`${2.51327 * (isUnlimited ? 0 : Math.min(usagePercent, 100))} 251.327`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-gray-900">{isUnlimited ? '∞' : `${usagePercent}%`}</span>
                <span className="text-xs text-gray-400">used</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900">
                {usageCount.toLocaleString()}
                <span className="font-normal text-gray-400"> / {isUnlimited ? '∞' : usageLimit.toLocaleString()}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">AI replies sent</p>
            </div>
            {atLimit && (
              <div className="mt-3 p-2 bg-red-50 rounded-lg text-center">
                <p className="text-xs text-red-600 font-medium">Limit reached — AI paused</p>
                <p className="text-xs text-red-400 mt-0.5">Upgrade to resume</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing plans */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">Choose a plan</h2>
        <p className="text-sm text-gray-400 mt-0.5">Upgrade or downgrade any time. Billed monthly in NGN.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {planOrder.map((planId) => {
          const plan   = plans[planId];
          if (!plan) return null;
          const colors   = PLAN_COLORS[planId];
          const Icon     = PLAN_ICONS[planId];
          const isCurrent = currentPlan === planId;
          const isUpgrade = planOrder.indexOf(planId) > planOrder.indexOf(currentPlan);

          return (
            <div key={planId}
              className={`relative bg-white rounded-xl border shadow-sm p-5 flex flex-col ${
                isCurrent       ? 'border-green-400 ring-2 ring-green-100' :
                plan.popular    ? 'border-green-200' : 'border-gray-100'
              }`}
            >
              {colors.badge && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs px-3 py-1 rounded-full bg-green-500 text-white font-semibold whitespace-nowrap shadow-sm">
                    {colors.badge}
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs px-3 py-1 rounded-full bg-gray-900 text-white font-semibold whitespace-nowrap">
                    Current plan
                  </span>
                </div>
              )}

              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors.bg}`}>
                <Icon size={16} className={colors.text} />
              </div>
              <p className="font-bold text-gray-900 text-base">{plan.name}</p>
              <div className="mt-1 mb-4">
                {plan.price === 0 ? (
                  <span className="text-2xl font-bold text-gray-900">Free</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-gray-900">₦{plan.price.toLocaleString()}</span>
                    <span className="text-xs text-gray-400">/month</span>
                  </>
                )}
              </div>

              <ul className="space-y-2 mb-5 flex-1">
                {(plan.features || []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <Check size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full py-2 text-center text-xs font-semibold text-green-600 bg-green-50 rounded-xl border border-green-200">
                  ✓ Current plan
                </div>
              ) : planId === 'free' ? (
                <div className="w-full py-2" />
              ) : (
                <button
                  onClick={() => handleUpgrade(planId)}
                  disabled={!!upgrading}
                  className={`w-full py-2.5 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${colors.btn}`}
                >
                  {upgrading === planId ? (
                    <><RefreshCw size={12} className="animate-spin" /> Redirecting...</>
                  ) : isUpgrade ? (
                    <><ArrowRight size={12} /> Upgrade to {plan.name}</>
                  ) : (
                    <><ArrowRight size={12} /> Switch to {plan.name}</>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="mt-8 md:mt-10 bg-white rounded-xl border border-gray-100 shadow-sm p-5 md:p-6">
        <h3 className="font-bold text-gray-900 mb-4">Billing FAQ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {[
            { q: 'When am I charged?',                   a: 'On the day you upgrade and every 30 days after. Paystack charges your card automatically.' },
            { q: 'What happens when I hit the AI limit?', a: 'AI replies pause. Customers get a polite fallback message. Manual replies still work. Upgrade to resume.' },
            { q: 'Can I cancel anytime?',                 a: 'Yes. You keep access until the end of your billing period. No refunds for partial months.' },
            { q: 'Do unused AI replies roll over?',       a: 'No. The counter resets on the 1st of each billing cycle.' },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-sm font-semibold text-gray-900 mb-1">{q}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}