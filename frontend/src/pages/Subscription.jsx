import { useState, useEffect } from 'react';
import {
  Check,
  Zap,
  TrendingUp,
  Crown,
  ArrowRight,
  AlertTriangle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import api from '../utils/api';

const PLAN_ICONS = {
  free: Zap,
  starter: TrendingUp,
  growth: TrendingUp,
  pro: Crown,
};

const PLAN_COLORS = {
  free: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    btn: 'bg-gray-900 hover:bg-gray-800',
    badge: '',
  },
  starter: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    btn: 'bg-blue-600 hover:bg-blue-700',
    badge: '',
  },
  growth: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    btn: 'bg-green-600 hover:bg-green-700',
    badge: 'Most popular',
  },
  pro: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    btn: 'bg-purple-600 hover:bg-purple-700',
    badge: 'Best value',
  },
};

export default function Subscription() {
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [upgrading, setUpgrading] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/subscription'),
      api.get('/subscription/plans'),
    ])
      .then(([s, p]) => {
        setSub(s.data.data);
        setPlans(p.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentPlan = sub?.plan || 'free';

  const handleUpgrade = async (planId) => {
    setUpgrading(planId);
    try {
      const { data } = await api.post('/subscription/upgrade', { planId });
      window.location.href = data.data.paymentLink;
    } catch {
      setMsg({ type: 'error', text: 'Upgrade failed' });
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel subscription?')) return;
    setCancelling(true);
    try {
      await api.post('/subscription/cancel');
      const res = await api.get('/subscription');
      setSub(res.data.data);
      setMsg({ type: 'info', text: 'Subscription cancelled' });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <RefreshCw className="animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your plan and usage
        </p>
      </div>

      {/* Message */}
      {msg && (
        <div className={`mb-6 p-4 rounded-xl text-sm flex items-center gap-2 ${
          msg.type === 'error'
            ? 'bg-red-50 text-red-600'
            : 'bg-green-50 text-green-600'
        }`}>
          {msg.type === 'error' ? <XCircle size={16} /> : <Check size={16} />}
          {msg.text}
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white border rounded-2xl p-6 mb-8 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500 uppercase">Current Plan</p>
            <h2 className="text-xl font-bold capitalize">{currentPlan}</h2>
          </div>
          <div className="text-green-600 font-bold text-xl">
            ₦{(plans[currentPlan]?.price || 0).toLocaleString()}/mo
          </div>
        </div>

        {currentPlan !== 'free' && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="mt-4 text-sm text-red-500 hover:underline"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
          </button>
        )}
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {['free', 'starter', 'growth', 'pro'].map((planId) => {
          const plan = plans[planId];
          if (!plan) return null;

          const Icon = PLAN_ICONS[planId];
          const colors = PLAN_COLORS[planId];
          const isCurrent = currentPlan === planId;

          return (
            <div
              key={planId}
              className={`border rounded-2xl p-5 flex flex-col ${
                isCurrent ? 'border-green-500 shadow-md' : 'border-gray-200'
              }`}
            >

              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg} mb-4`}>
                <Icon className={colors.text} size={18} />
              </div>

              {/* Title */}
              <h3 className="font-semibold capitalize">{plan.name}</h3>

              {/* Price */}
              <p className="text-xl font-bold mt-2">
                {plan.price === 0 ? 'Free' : `₦${plan.price.toLocaleString()}`}
              </p>

              {/* Features */}
              <ul className="mt-4 space-y-2 text-sm text-gray-600 flex-1">
                {plan.features?.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <Check size={14} className="text-green-500 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Button */}
              {isCurrent ? (
                <div className="mt-4 text-center text-sm text-green-600 font-semibold">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(planId)}
                  disabled={upgrading}
                  className={`mt-4 py-2 rounded-xl text-white text-sm flex items-center justify-center gap-2 ${colors.btn}`}
                >
                  {upgrading === planId ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                  {plan.price === 0 ? 'Select' : 'Upgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}