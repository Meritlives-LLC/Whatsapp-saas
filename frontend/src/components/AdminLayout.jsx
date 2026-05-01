import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, BarChart2,
  Shield, LogOut, Zap, AlertTriangle, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/admin',          icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/businesses', icon: Users,          label: 'Businesses' },
  { to: '/admin/revenue',  icon: CreditCard,       label: 'Revenue' },
  { to: '/admin/settings', icon: Settings,         label: 'Settings' },
];

export default function AdminLayout({ children }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-950 font-sans">
      {/* Dark admin sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm">WA AutoBot</span>
          </div>
          <span className="text-xs text-red-400 font-semibold tracking-widest uppercase">Admin Panel</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = pathname === to || (to !== '/admin' && pathname.startsWith(to));
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}>
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Back to dashboard link */}
        <div className="px-3 pb-3">
          <Link to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <Zap size={14} />
            Back to Dashboard
          </Link>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-red-900 rounded-full flex items-center justify-center text-red-300 font-bold text-xs">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">Administrator</p>
            </div>
            <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-gray-950">
        {children}
      </main>
    </div>
  );
}
