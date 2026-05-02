import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Eye, Ban, Trash2, Zap, Crown, TrendingUp, ChevronRight, X, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../utils/api';
import logo from "../../assets/logo.svg";

const PLAN_BADGE = {
  free:    'bg-gray-800 text-gray-400',
  starter: 'bg-blue-900 text-blue-300',
  growth:  'bg-green-900 text-green-300',
  pro:     'bg-purple-900 text-purple-300',
};

const PLAN_ICONS = { free: LogoIcon, starter: TrendingUp, growth: TrendingUp, pro: Crown };

// ── Business Detail Modal ────────────────────────────────────────────────────
function BusinessModal({ userId, onClose, onRefresh }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [action, setAction]     = useState(null); // 'plan' | 'credits' | 'delete'
  const [planForm, setPlanForm] = useState({ plan: 'starter', durationDays: 30 });
  const [credits, setCredits]   = useState(100);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    api.get(`/admin/businesses/${userId}`)
      .then(r => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [userId]);

  const overridePlan = async () => {
    setSaving(true);
    try {
      const r = await api.patch(`/admin/businesses/${userId}/plan`, planForm);
      setMsg(r.data.message);
      const fresh = await api.get(`/admin/businesses/${userId}`);
      setData(fresh.data.data);
      onRefresh();
    } finally { setSaving(false); setAction(null); }
  };

  const addCredits = async () => {
    setSaving(true);
    try {
      const r = await api.patch(`/admin/businesses/${userId}/credits`, { credits });
      setMsg(r.data.message);
    } finally { setSaving(false); setAction(null); }
  };

  const toggleSuspend = async () => {
    if (!confirm('Toggle suspend status for this account?')) return;
    const r = await api.patch(`/admin/businesses/${userId}/suspend`);
    setMsg(r.data.message);
    const fresh = await api.get(`/admin/businesses/${userId}`);
    setData(fresh.data.data);
    onRefresh();
  };

  const deleteAccount = async () => {
    if (!confirm('PERMANENTLY delete this account and all its data? This cannot be undone.')) return;
    await api.delete(`/admin/businesses/${userId}`);
    onRefresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h3 className="font-bold text-white">Business Details</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {msg && (
              <div className="p-3 bg-green-900/50 border border-green-700 rounded-lg text-xs text-green-300">{msg}</div>
            )}

            {/* Identity */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Account</p>
              <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Name</span>
                  <span className="text-white font-medium">{data?.user?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Email</span>
                  <span className="text-white">{data?.user?.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Business</span>
                  <span className="text-white">{data?.business?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Status</span>
                  <span className={data?.user?.isActive ? 'text-green-400' : 'text-red-400'}>
                    {data?.user?.isActive ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Joined</span>
                  <span className="text-gray-300">{new Date(data?.user?.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Subscription */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Subscription</p>
              <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                {[
                  ['Plan', <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[data?.subscription?.plan || 'free']}`}>{data?.subscription?.plan || 'free'}</span>],
                  ['Status', data?.subscription?.status || 'active'],
                  ['AI Used', `${data?.subscription?.usage?.aiRepliesCount || 0} replies`],
                  ['Period End', data?.subscription?.currentPeriodEnd ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString() : '—'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Conversation Stats</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Total', data?.stats?.total || 0],
                  ['Open', data?.stats?.open || 0],
                  ['Leads', data?.stats?.leads || 0],
                ].map(([label, val]) => (
                  <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-white">{val}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Admin Actions</p>
              <div className="space-y-2">

                {/* Override plan */}
                {action === 'plan' ? (
                  <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-white font-medium">Override Plan</p>
                    <select value={planForm.plan} onChange={e => setPlanForm(f => ({ ...f, plan: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-2 focus:outline-none">
                      {['free','starter','growth','pro'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="flex gap-2 items-center">
                      <input type="number" value={planForm.durationDays}
                        onChange={e => setPlanForm(f => ({ ...f, durationDays: Number(e.target.value) }))}
                        className="w-20 bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-2 focus:outline-none" />
                      <span className="text-xs text-gray-400">days duration</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={overridePlan} disabled={saving}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium disabled:opacity-60">
                        {saving ? 'Saving...' : 'Apply Plan'}
                      </button>
                      <button onClick={() => setAction(null)} className="px-3 py-2 bg-gray-700 text-gray-300 text-xs rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAction('plan')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl text-xs text-white transition-colors">
                    <span>Override subscription plan</span>
                    <ChevronRight size={14} className="text-gray-500" />
                  </button>
                )}

                {/* Add credits */}
                {action === 'credits' ? (
                  <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-white font-medium">Add AI Credits</p>
                    <input type="number" value={credits} onChange={e => setCredits(Number(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded-lg px-3 py-2 focus:outline-none" />
                    <div className="flex gap-2">
                      <button onClick={addCredits} disabled={saving}
                        className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg font-medium disabled:opacity-60">
                        {saving ? 'Adding...' : 'Add Credits'}
                      </button>
                      <button onClick={() => setAction(null)} className="px-3 py-2 bg-gray-700 text-gray-300 text-xs rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAction('credits')}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl text-xs text-white transition-colors">
                    <span>Add AI reply credits</span>
                    <ChevronRight size={14} className="text-gray-500" />
                  </button>
                )}

                {/* Suspend */}
                <button onClick={toggleSuspend}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-amber-950 border border-gray-700 hover:border-amber-800 rounded-xl text-xs text-amber-400 transition-colors">
                  <span>{data?.user?.isActive ? 'Suspend account' : 'Reactivate account'}</span>
                  <Ban size={14} />
                </button>

                {/* Delete */}
                <button onClick={deleteAccount}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-red-950 border border-gray-700 hover:border-red-800 rounded-xl text-xs text-red-400 transition-colors">
                  <span>Delete account permanently</span>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Businesses Page ─────────────────────────────────────────────────────
export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.append('search', search);
      if (planFilter) params.append('plan', planFilter);
      const { data } = await api.get(`/admin/businesses?${params}`);
      setBusinesses(data.data);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, search, planFilter]);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Businesses</h1>
          <p className="text-sm text-gray-500 mt-1">{total} registered accounts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email..."
            className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500" />
        </div>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 text-sm text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-gray-500">
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {['Business', 'Owner', 'Plan', 'AI Usage', 'Status', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12">
                <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : businesses.map(biz => {
              const plan = biz.subscription?.plan || 'free';
              const Icon = PLAN_ICONS[planId];

              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors.bg}`}>
                {planId === 'free' ? (
                  <Icon />
                ) : (
                  <Icon size={16} className={colors.text} />
                )}
              </div>
              const usage = biz.subscription?.usage?.aiRepliesCount || 0;
              const limit = biz.subscription?.limits?.aiRepliesPerMonth || 100;
              const pct = Math.min(100, Math.round((usage / limit) * 100));

              return (
                <tr key={biz._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-xs font-bold text-gray-400">
                        {(biz.business?.name || biz.name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{biz.business?.name || '—'}</p>
                        <p className="text-xs text-gray-500">{biz.business?.industry || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-white">{biz.name}</p>
                    <p className="text-xs text-gray-500">{biz.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${PLAN_BADGE[plan]}`}>
                      <Icon size={10} /> {plan}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-xs text-white mb-1">{usage} / {limit >= 999999 ? '∞' : limit}</p>
                    <div className="w-20 bg-gray-800 rounded-full h-1">
                      <div className={`h-1 rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium ${biz.isActive ? 'text-green-400' : 'text-red-400'}`}>
                      {biz.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-500">
                    {formatDistanceToNow(new Date(biz.createdAt))} ago
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => setSelected(biz._id)}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && !businesses.length && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-600 text-sm">No businesses found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 15 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: Math.ceil(total / 15) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 text-xs rounded-lg ${page === p ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <BusinessModal userId={selected} onClose={() => setSelected(null)} onRefresh={fetchBusinesses} />
      )}
    </div>
  );
}
