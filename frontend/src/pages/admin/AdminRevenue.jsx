import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Crown } from 'lucide-react';
import api from '../../utils/api';

export default function AdminRevenue() {
  const [data, setData]   = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/admin/revenue'), api.get('/admin/stats')])
      .then(([r, s]) => { setData(r.data.data); setStats(s.data.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const totalRevAllTime = data?.revenueByMonth?.reduce((sum, m) => sum + m.revenue, 0) || 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Revenue</h1>
        <p className="text-sm text-gray-500 mt-1">Subscription income overview</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Monthly Recurring Revenue', value: `₦${(stats?.mrr || 0).toLocaleString()}`, icon: TrendingUp, color: 'bg-green-700' },
          { label: 'Revenue This Month', value: `₦${(stats?.revenueThisMonth || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-blue-700' },
          { label: 'All-Time Revenue (6mo)', value: `₦${totalRevAllTime.toLocaleString()}`, icon: Crown, color: 'bg-purple-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={16} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Revenue bar chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-white mb-5">Monthly Revenue (Last 6 Months)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data?.revenueByMonth || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false}
              tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#fff' }}
              formatter={v => [`₦${v.toLocaleString()}`, 'Revenue']}
            />
            <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top paying businesses */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">Top Paying Businesses</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {['#', 'Business', 'Owner', 'Plan', 'Last Payment', 'Date'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.topBusinesses || []).map((sub, i) => (
              <tr key={sub._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-5 py-3 text-xs text-gray-500">#{i + 1}</td>
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-white">{sub.business?.name || '—'}</p>
                </td>
                <td className="px-5 py-3">
                  <p className="text-xs text-gray-400">{sub.business?.owner?.email || '—'}</p>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    { free:'bg-gray-800 text-gray-400', starter:'bg-blue-900 text-blue-300',
                      growth:'bg-green-900 text-green-300', pro:'bg-purple-900 text-purple-300' }[sub.plan]
                  }`}>{sub.plan}</span>
                </td>
                <td className="px-5 py-3 text-sm text-green-400 font-semibold">
                  ₦{(sub.lastPaymentAmount || 0).toLocaleString()}
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">
                  {sub.lastPaymentAt ? new Date(sub.lastPaymentAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {!data?.topBusinesses?.length && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-600 text-sm">No payments yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
