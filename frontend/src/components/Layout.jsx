import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
  LayoutDashboard, MessageSquare, Package, Calendar,
  CreditCard, Settings, LogOut, Zap, BarChart2, Star, AlertTriangle, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/subscription', icon: Star, label: 'Subscription' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { user, business, logout } = useAuth();
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (business?._id) {
      api.get('/subscription').then(({ data }) => setSub(data.data)).catch(() => {});
    }
  }, [business?._id]);

  const usagePercent = sub
    ? Math.min(100, Math.round(((sub.usage?.aiRepliesCount || 0) / (sub.limits?.aiRepliesPerMonth || 100)) * 100))
    : 0;
  const atLimit = usagePercent >= 100;
  const nearLimit = usagePercent >= 80 && !atLimit;
  const isUnlimited = (sub?.limits?.aiRepliesPerMonth || 0) >= 999999;
  const planName = sub?.plan ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) : 'Free';

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">WA AutoBot</span>
          </div>
          <p className="text-xs text-gray-400 mt-1 truncate">{business?.name}</p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = pathname === to;
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}>
                <Icon size={18} className={active ? 'text-green-600' : ''} />
                {label}
                {label === 'Subscription' && (atLimit || nearLimit) && (
                  <AlertTriangle size={13} className={atLimit ? 'text-red-500 ml-auto' : 'text-amber-500 ml-auto'} />
                )}
              </Link>
            );
          })}
        </nav>


        {/* Admin shortcut */}
        {user?.role === 'admin' && (
          <div className="mx-4 mb-3">
            <Link to="/admin"
              className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
              <Shield size={13} /> Admin Panel
            </Link>
          </div>
        )}

        {sub && (
          <div className="mx-4 mb-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600">{planName} plan</span>
              <Link to="/subscription" className="text-xs text-green-600 hover:underline font-medium">
                {sub.plan === 'free' ? 'Upgrade' : 'Manage'}
              </Link>
            </div>
            {!isUnlimited ? (
              <>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>AI replies</span>
                  <span>{sub.usage?.aiRepliesCount || 0} / {sub.limits?.aiRepliesPerMonth || 100}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-400' : 'bg-green-500'}`}
                    style={{ width: `${usagePercent}%` }} />
                </div>
                {atLimit && <p className="text-xs text-red-500 mt-1.5 font-medium">AI paused — limit reached</p>}
              </>
            ) : (
              <p className="text-xs text-green-600 font-medium">Unlimited AI replies</p>
            )}
          </div>
        )}

        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto flex flex-col">
        {atLimit && pathname !== '/subscription' && (
          <div className="bg-red-500 text-white text-xs text-center py-2 px-4 flex items-center justify-center gap-2 flex-shrink-0">
            <AlertTriangle size={13} />
            AI replies paused — monthly limit reached.
            <Link to="/subscription" className="underline font-semibold ml-1">Upgrade now</Link>
          </div>
        )}
        {nearLimit && !atLimit && pathname !== '/subscription' && (
          <div className="bg-amber-400 text-amber-900 text-xs text-center py-2 px-4 flex items-center justify-center gap-2 flex-shrink-0">
            <AlertTriangle size={13} />
            {usagePercent}% of monthly AI limit used.
            <Link to="/subscription" className="underline font-semibold ml-1">Upgrade to avoid interruptions</Link>
          </div>
        )}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
