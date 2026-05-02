// Pricing.jsx — mobile responsive
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const plans = [
  {
    id: 'free', name: 'Free', price: 0,
    desc: 'Get started, no credit card needed',
    color: 'border-gray-200',
    features: ['100 AI replies / month', '1 WhatsApp number', 'Up to 5 products', 'Basic analytics', 'Paystack payments'],
    cta: 'Get started free',
    ctaStyle: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
  },
  {
    id: 'starter', name: 'Starter', price: 8000,
    desc: 'For small businesses just growing',
    color: 'border-blue-200',
    features: ['1,000 AI replies / month', '1 WhatsApp number', 'Up to 50 products', 'Full analytics', 'Bookings & reminders', 'Auto follow-up', 'Lead capture', 'Email support'],
    cta: 'Upgrade to Starter',
    ctaStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  {
    id: 'growth', name: 'Growth', price: 20000,
    desc: 'For businesses scaling fast',
    popular: true, color: 'border-green-400',
    features: ['5,000 AI replies / month', '3 WhatsApp numbers', 'Unlimited products', 'Advanced analytics', 'All Starter features', 'Priority support', 'Custom AI persona'],
    cta: 'Upgrade to Growth',
    ctaStyle: 'bg-green-500 hover:bg-green-600 text-white',
  },
  {
    id: 'pro', name: 'Pro', price: 45000,
    desc: 'For agencies and large businesses',
    color: 'border-purple-200',
    features: ['Unlimited AI replies', 'Up to 10 WhatsApp numbers', 'Unlimited products & team', 'White-label dashboard', 'All Growth features', 'Dedicated support', 'SLA guarantee'],
    cta: 'Upgrade to Pro',
    ctaStyle: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);

  const handleUpgrade = async (planId) => {
    if (!user) { navigate('/login'); return; }
    if (planId === 'free') { navigate('/'); return; }
    setLoading(planId);
    try {
      const { data } = await api.post('/subscription/upgrade', { planId });
      window.location.href = data.data.paymentLink;
    } catch (err) {
      alert(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans py-10 md:py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full mb-4">
            <Zap size={14} className="text-green-600" />
            <span className="text-sm text-green-700 font-medium">Simple, transparent pricing</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Choose your plan</h1>
          <p className="text-gray-500 text-base md:text-lg">Start free. Upgrade when your business needs more.</p>
        </div>

        {/* 1 col on mobile, 2 on tablet, 4 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div key={plan.id}
              className={`relative bg-white rounded-2xl border-2 ${plan.color} p-5 md:p-6 flex flex-col ${plan.popular ? 'shadow-lg' : 'shadow-sm'}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    <Star size={10} /> Most popular
                  </span>
                </div>
              )}
              <div className="mb-5">
                <h3 className="font-bold text-gray-900 text-lg mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-400 mb-3">{plan.desc}</p>
                <div className="flex items-baseline gap-1">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-gray-900">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-gray-900">₦{plan.price.toLocaleString()}</span>
                      <span className="text-gray-400 text-sm">/month</span>
                    </>
                  )}
                </div>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => handleUpgrade(plan.id)} disabled={loading === plan.id}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${plan.ctaStyle}`}>
                {loading === plan.id ? 'Redirecting...' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-10 md:mt-12 text-center space-y-2">
          <p className="text-sm text-gray-400">All plans include Paystack payment processing for your customers.</p>
          <p className="text-sm text-gray-400">
            Questions?{' '}
            <a href="mailto:support@waautobot.com" className="text-green-600 hover:underline">Contact support</a>
          </p>
        </div>
      </div>
    </div>
  );
}