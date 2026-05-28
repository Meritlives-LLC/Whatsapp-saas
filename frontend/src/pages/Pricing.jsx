// Pricing.jsx — public page, fetches plans from API (currency-aware)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import logo from '../assets/logo.svg';

const PLAN_STYLES = {
  free:    { color: 'border-gray-200',  cta: 'border border-gray-200 text-gray-700 hover:bg-gray-50' },
  starter: { color: 'border-blue-200',  cta: 'bg-blue-600 hover:bg-blue-700 text-white' },
  growth:  { color: 'border-green-400', cta: 'bg-green-500 hover:bg-green-600 text-white' },
  pro:     { color: 'border-purple-200', cta: 'bg-purple-600 hover:bg-purple-700 text-white' },
};

const PLAN_ORDER = ['free', 'starter', 'growth', 'pro'];

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans]       = useState(null);   // null = loading
  const [currency, setCurrency] = useState('NGN');
  const [currSym, setCurrSym]   = useState('₦');
  const [loading, setLoading]   = useState(null);   // plan id being redirected

  useEffect(() => {
    api.get('/subscription/plans')
      .then(({ data }) => {
        setPlans(data.data);
        const cur = data.currency || 'NGN';
        setCurrency(cur);
        const sym = Object.values(data.data).find(p => p.currencySymbol)?.currencySymbol || '₦';
        setCurrSym(sym);
      })
      .catch(() => {
        // Fallback static data if API unreachable (public page, user may not be logged in)
        setPlans({
          free:    { id: 'free',    name: 'Free',    price: 0,     displayPrice: 0,     features: ['100 AI replies / month', '1 WhatsApp number', 'Up to 5 products', 'Basic analytics', 'Paystack payments'] },
          starter: { id: 'starter', name: 'Starter', price: 8000,  displayPrice: 8000,  features: ['1,000 AI replies / month', '1 WhatsApp number', 'Up to 50 products', 'Full analytics', 'Bookings & reminders', 'Auto follow-up', 'Lead capture', 'Email support'] },
          growth:  { id: 'growth',  name: 'Growth',  price: 20000, displayPrice: 20000, popular: true, features: ['5,000 AI replies / month', '3 WhatsApp numbers', 'Unlimited products', 'Advanced analytics', 'All Starter features', 'Priority support', 'Custom AI persona'] },
          pro:     { id: 'pro',     name: 'Pro',     price: 45000, displayPrice: 45000, features: ['Unlimited AI replies', 'Up to 10 WhatsApp numbers', 'Unlimited products & team', 'White-label dashboard', 'All Growth features', 'Dedicated support', 'SLA guarantee'] },
        });
      });
  }, []);

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

  const formatPrice = (plan) => {
    if (!plan || plan.price === 0) return null;
    const amount = plan.displayPrice ?? plan.price;
    return `${currSym}${amount.toLocaleString()}`;
  };

  const ngnNote = currency !== 'NGN'
    ? <p className="text-xs text-gray-400 mt-1">Payments processed in ₦ NGN via Paystack</p>
    : null;

  return (
    <div className="min-h-screen bg-gray-50 font-sans py-10 md:py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <img src={logo} alt="WA AutoBot Logo" className="w-10 h-10 object-contain mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Choose your plan</h1>
          <p className="text-gray-500 text-base md:text-lg">Start free. Upgrade when your business needs more.</p>
          {ngnNote}
        </div>

        {!plans ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PLAN_ORDER.map((planId) => {
              const plan = plans[planId];
              if (!plan) return null;
              const style = PLAN_STYLES[planId];
              const price = formatPrice(plan);

              return (
                <div key={planId}
                  className={`relative bg-white rounded-2xl border-2 ${style.color} p-5 md:p-6 flex flex-col ${plan.popular ? 'shadow-lg' : 'shadow-sm'}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="flex items-center gap-1 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        <Star size={10} /> Most popular
                      </span>
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="font-bold text-gray-900 text-lg mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      {!price ? (
                        <span className="text-3xl font-bold text-gray-900">Free</span>
                      ) : (
                        <>
                          <span className="text-3xl font-bold text-gray-900">{price}</span>
                          <span className="text-gray-400 text-sm">/month</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-2.5 flex-1 mb-6">
                    {(plan.features || []).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => handleUpgrade(planId)} disabled={loading === planId}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${style.cta}`}>
                    {loading === planId ? 'Redirecting...' : planId === 'free' ? 'Get started free' : `Upgrade to ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

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
