import { useEffect, useState } from 'react';
import { Users, DollarSign, MessageSquare, Zap, TrendingUp, AlertTriangle, UserCheck, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import api from '../../utils/api';
import logo from "../../assets/logo.svg";

const LogoIcon = ({ size = 16 }) => (
  <img
    src={logo}
    alt="logo"
    style={{ width: size, height: size }}
    className="object-contain"
  />
);

const KPI = ({ label, value, sub, icon: Icon, color, dark }) => (
  <div className={`rounded-xl p-5 border ${dark ? 'bg-gray-900 border-gray-800' : 'bg-gray-900 border-gray-800'}`}>
    <div className="flex items-start justify-between mb-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-green-400 mt-1">{sub}</p>}
  </div>
);

const PLAN_COLORS = { free: '#6b7280', starter: '#3b82f6', growth: '#22c55e', pro: '#a855f7' };

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/activity'),
      api.get('/admin/revenue'),
    ]).then(([s, a, r]) => {
      setStats(s.data.data);
      setActivity(a.data.data);
      setRevenueData(r.data.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const planData = stats ? Object.entries(stats.planBreakdown).map(([plan, count]) => ({
    plan: plan.charAt(0).toUpperCase() + plan.slice(1),
    count,
    fill: PLAN_COLORS[plan],
  })) : [];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-3">
        <img src={logo} alt="logo" className="w-8 h-8 object-contain" />
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time stats across all businesses
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KPI label="Total businesses" value={stats?.totalBusinesses || 0}
          sub={`+${stats?.newThisMonth || 0} this month`} icon={Users} color="bg-blue-600" />
        <KPI label="Monthly Recurring Revenue" value={`₦${(stats?.mrr || 0).toLocaleString()}`}
          sub="Active subscriptions" icon={DollarSign} color="bg-green-600" />
        <KPI label="Total AI replies sent" value={(stats?.totalAiReplies || 0).toLocaleString()}
          icon={LogoIcon} color="bg-purple-600" />
        <KPI label="Total conversations" value={(stats?.totalConversations || 0).toLocaleString()}
          icon={MessageSquare} color="bg-amber-600" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KPI label="Revenue this month" value={`₦${(stats?.revenueThisMonth || 0).toLocaleString()}`}
          icon={TrendingUp} color="bg-emerald-600" />
        <KPI label="Past-due accounts" value={stats?.pastDueAccounts || 0}
          sub={stats?.pastDueAccounts > 0 ? "Needs attention" : "All clear"} icon={AlertTriangle}
          color={stats?.pastDueAccounts > 0 ? "bg-red-600" : "bg-gray-700"} />
        <KPI label="User growth" value={`${stats?.growthPercent >= 0 ? '+' : ''}${stats?.growthPercent || 0}%`}
          sub="vs last month" icon={TrendingUp} color="bg-cyan-600" />
        <KPI label="Paid subscribers" value={
          (stats?.planBreakdown?.starter || 0) +
          (stats?.planBreakdown?.growth || 0) +
          (stats?.planBreakdown?.pro || 0)
        } sub="Starter + Growth + Pro" icon={UserCheck} color="bg-indigo-600" />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Revenue chart */}
        <div className="col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Revenue — Last 6 Months</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData?.revenueByMonth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
                tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#fff' }}
                formatter={v => [`₦${v.toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Plan breakdown */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Plan Distribution</h3>
          <div className="space-y-3">
            {planData.map(({ plan, count, fill }) => {
              const total = stats?.totalBusinesses || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={plan}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{plan}</span>
                    <span className="text-white font-medium">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: fill }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* MRR breakdown */}
          <div className="mt-5 pt-4 border-t border-gray-800 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">MRR Breakdown</p>
            {[
              { label: 'Starter', count: stats?.planBreakdown?.starter || 0, price: 8000 },
              { label: 'Growth',  count: stats?.planBreakdown?.growth  || 0, price: 20000 },
              { label: 'Pro',     count: stats?.planBreakdown?.pro     || 0, price: 45000 },
            ].map(({ label, count, price }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-gray-400">{count}× {label}</span>
                <span className="text-green-400 font-medium">₦{(count * price).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-2 border-t border-gray-800">
              <span className="text-white font-semibold">Total MRR</span>
              <span className="text-green-400 font-bold">₦{(stats?.mrr || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="grid grid-cols-2 gap-6">
        {/* New signups */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity size={14} className="text-blue-400" /> Recent Signups
          </h3>
          <div className="space-y-3">
            {(activity?.recentUsers || []).map(u => (
              <div key={u._id} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center text-xs font-semibold text-gray-400">
                  {u.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(u.createdAt))} ago</p>
                  <span className={`text-xs ${u.isActive ? 'text-green-400' : 'text-red-400'}`}>
                    {u.isActive ? 'active' : 'suspended'}
                  </span>
                </div>
              </div>
            ))}
            {!activity?.recentUsers?.length && <p className="text-xs text-gray-600 text-center py-4">No signups yet</p>}
          </div>
        </div>

        {/* Past-due + recent conversations */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" /> Past-Due Accounts
          </h3>
          {(activity?.pastDue || []).length ? (
            <div className="space-y-3">
              {activity.pastDue.map(sub => (
                <div key={sub._id} className="flex items-center justify-between p-3 bg-red-950 border border-red-900 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-white">{sub.business?.name || '—'}</p>
                    <p className="text-xs text-gray-400">{sub.business?.owner?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-400 font-medium capitalize">{sub.plan} plan</p>
                    <p className="text-xs text-gray-500">Payment failed</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-10 h-10 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-2">
                <UserCheck size={18} className="text-green-400" />
              </div>
              <p className="text-xs text-gray-400">No past-due accounts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
