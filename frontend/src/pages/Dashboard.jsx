import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Users, TrendingUp, DollarSign, CheckCircle, Clock, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const StatCard = ({ label, value, icon: Icon, color, change }) => (
  <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-100 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs md:text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
        {change && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><ArrowUpRight size={12} />{change}</p>}
      </div>
      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
    </div>
  </div>
);

const chartData = [
  { day: 'Mon', messages: 12 }, { day: 'Tue', messages: 28 },
  { day: 'Wed', messages: 19 }, { day: 'Thu', messages: 45 },
  { day: 'Fri', messages: 38 }, { day: 'Sat', messages: 22 },
  { day: 'Sun', messages: 14 },
];

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { business } = useAuth();

  useEffect(() => {
    api.get('/analytics').then(({ data }) => setAnalytics(data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const stats = analytics?.conversations || {};
  const revenue = analytics?.revenue || {};

  const getGreeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return { text: 'Good morning', emoji: '🌅' };
    if (h < 17) return { text: 'Good afternoon', emoji: '☀️' };
    if (h < 21) return { text: 'Good evening', emoji: '🌆' };
    return { text: 'Good night', emoji: '🌙' };
  }, []);

  const [greeting, setGreeting] = useState(getGreeting);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => {
      setClock(new Date());
      setGreeting(getGreeting());
    }, 1000);
    return () => clearInterval(tick);
  }, [getGreeting]);

  const timeString = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = clock.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = business?.name?.split(' ')[0] || 'there';

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          {greeting.text}, {firstName}! {greeting.emoji}
        </h1>
        <p className="text-gray-400 text-sm mt-0.5 font-mono tabular-nums">
          {dateString} · {timeString}
        </p>
      </div>

      {/* Stats — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <StatCard label="Total Conversations" value={stats.total || 0} icon={MessageSquare} color="bg-blue-500" />
        <StatCard label="Active Leads" value={stats.leads || 0} icon={Users} color="bg-purple-500" />
        <StatCard label="Conversion Rate" value={`${analytics?.conversionRate || 0}%`} icon={TrendingUp} color="bg-green-500" />
        <StatCard label="Revenue (NGN)" value={`₦${(revenue.total || 0).toLocaleString()}`} icon={DollarSign} color="bg-amber-500" />
      </div>

      {/* Chart + Recent — stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Chart — full width on mobile */}
        <div className="md:col-span-2 bg-white rounded-xl p-4 md:p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Messages This Week</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="messages" stroke="#22c55e" strokeWidth={2} fill="url(#msgGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent conversations */}
        <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Chats</h3>
          <div className="space-y-3">
            {(analytics?.recentConversations || []).map((conv) => (
              <div key={conv._id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-semibold text-xs flex-shrink-0">
                  {(conv.customerName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{conv.customerName || conv.customerPhone}</p>
                  <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(conv.lastMessageAt))} ago</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  conv.status === 'open' ? 'bg-green-50 text-green-700' :
                  conv.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {conv.status}
                </span>
              </div>
            ))}
            {!analytics?.recentConversations?.length && (
              <p className="text-sm text-gray-400 text-center py-4">No conversations yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick status — 3 cols on mobile too, smaller padding */}
      <div className="mt-4 md:mt-6 grid grid-cols-3 gap-3 md:gap-4">
        {[
          { label: 'Open', value: stats.open || 0, icon: Clock, color: 'text-blue-600 bg-blue-50' },
          { label: 'Closed', value: stats.closed || 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
          { label: 'Paid Orders', value: revenue.count || 0, icon: DollarSign, color: 'text-amber-600 bg-amber-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-3 md:p-4 border border-gray-100 flex items-center gap-2 md:gap-4">
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}