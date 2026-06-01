/**
 * useSubscription — shared hook used by Subscription.jsx and SubscriptionPage.jsx
 * Fetches /subscription, /subscription/plans, and /subscription/history
 * and provides upgrade / cancel / reactivate action helpers.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export function useSubscription({ verifyRef } = {}) {
  const [sub, setSub]           = useState(null);
  const [plans, setPlans]       = useState({});
  const [currency, setCurrency] = useState('NGN');
  const [currSym, setCurrSym]   = useState('₦');
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, plansRes, histRes] = await Promise.all([
        api.get('/subscription'),
        api.get('/subscription/plans'),
        api.get('/subscription/history').catch(() => ({ data: { data: [] } })),
      ]);
      setSub(subRes.data.data);
      setPlans(plansRes.data.data);
      setHistory(histRes.data.data || []);
      const cur = plansRes.data.currency || 'NGN';
      setCurrency(cur);
      const sym = Object.values(plansRes.data.data).find(p => p.currencySymbol)?.currencySymbol || '₦';
      setCurrSym(sym);
    } catch (err) {
      setError('Failed to load subscription data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: load data, and optionally verify a Paystack redirect ref
  useEffect(() => {
    if (verifyRef) {
      api.post('/subscription/verify', { reference: verifyRef })
        .catch(() => {})
        .finally(() => load());
    } else {
      load();
    }
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const upgrade = async (planId) => {
    const { data } = await api.post('/subscription/upgrade', { planId });
    return data.data.paymentLink;
  };

  const cancel = async () => {
    const { data } = await api.post('/subscription/cancel');
    await load();
    return data.message;
  };

  const reactivate = async () => {
    const { data } = await api.post('/subscription/reactivate');
    await load();
    return data.message;
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const planOrder   = ['free', 'starter', 'growth', 'pro'];
  const currentPlan = sub?.plan || 'free';
  const usageCount  = sub?.usage?.aiRepliesCount || 0;
  const usageLimit  = sub?.limits?.aiRepliesPerMonth || 100;
  const isUnlimited = usageLimit >= 999999;
  const usagePct    = isUnlimited ? 0 : Math.min(100, Math.round((usageCount / usageLimit) * 100));
  const nearLimit   = usagePct >= 80;
  const atLimit     = usagePct >= 100;

  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toLocaleDateString('en-NG', { day: 'numeric', month: 'long' });

  const formatPrice = (plan) => {
    if (!plan || plan.price === 0) return 'Free';
    const amount = plan.displayPrice ?? plan.price;
    return `${currSym}${amount.toLocaleString()}`;
  };

  return {
    // Data
    sub, plans, currency, currSym, history, loading, error,
    // Derived
    currentPlan, usageCount, usageLimit, isUnlimited, usagePct, nearLimit, atLimit,
    planOrder, resetDate, formatPrice,
    // Actions
    load, upgrade, cancel, reactivate,
  };
}
