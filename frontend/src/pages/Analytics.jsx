import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../utils/api';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => { api.get('/analytics').then(({ data }) => setData(data.data)); }, []);

  if (!data) return <div className="p-8 text-gray-400">Loading analytics...</div>;

  const convPieData = [
    { name: 'Open', value: data.conversations.open },
    { name: 'Closed', value: data.conversations.closed },
    { name: 'Leads', value: data.conversations.leads },
    { name: 'Pending', value: Math.max(0, data.conversations.total - data.conversations.open - data.conversations.closed) },
  ].filter(d => d.value > 0);

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Analytics</h1>

      {/* KPIs — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          { label: 'Total Conversations', value: data.conversations.total, color: 'bg-blue-500' },
          { label: 'Total Leads', value: data.conversations.leads, color: 'bg-purple-500' },
          { label: 'Conversion Rate', value: `${data.conversionRate}%`, color: 'bg-green-500' },
          { label: 'Total Revenue', value: `₦${(data.revenue.total || 0).toLocaleString()}`, color: 'bg-amber-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 md:p-5 border border-gray-100 shadow-sm">
            <div className={`w-2 h-6 md:h-8 rounded-full ${color} mb-2 md:mb-3`} />
            <p className="text-xl md:text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts — stacked on mobile, side-by-side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Conversation Status Pie */}
        <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Conversation Breakdown</h3>
          {convPieData.length ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={convPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {convPieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {convPieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Revenue Summary */}
        <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Payment Summary</h3>
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between p-3 md:p-4 bg-green-50 rounded-xl">
              <p className="text-sm font-medium text-gray-700">Total Revenue</p>
              <p className="text-lg md:text-xl font-bold text-green-600">₦{(data.revenue.total || 0).toLocaleString()}</p>
            </div>
            <div className="flex items-center justify-between p-3 md:p-4 bg-blue-50 rounded-xl">
              <p className="text-sm font-medium text-gray-700">Successful Payments</p>
              <p className="text-lg md:text-xl font-bold text-blue-600">{data.revenue.count || 0}</p>
            </div>
            <div className="flex items-center justify-between p-3 md:p-4 bg-purple-50 rounded-xl">
              <p className="text-sm font-medium text-gray-700">Avg. Order Value</p>
              <p className="text-lg md:text-xl font-bold text-purple-600">
                {data.revenue.count > 0
                  ? `₦${Math.round(data.revenue.total / data.revenue.count).toLocaleString()}`
                  : '₦0'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}