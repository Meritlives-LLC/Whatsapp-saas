import {
  LayoutDashboard,
  MessageSquare,
  Package,
  Calendar,
  CreditCard,
  Settings,
  LogOut,
  Zap,
  BarChart2,
  Star,
  AlertTriangle,
  Shield
} from "lucide-react";

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

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
  const location = useLocation();
  const pathname = location.pathname;

  const { user, business, logout } = useAuth();
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (business?._id) {
      api.get('/subscription')
        .then(({ data }) => setSub(data.data))
        .catch(() => {});
    }
  }, [business?._id]);

  // 🔒 SAFE FALLBACKS
  const safeSub = sub || {
    usage: { aiRepliesCount: 0 },
    limits: { aiRepliesPerMonth: 100 },
    plan: "free"
  };

  const usagePercent = Math.min(
    100,
    Math.round(
      ((safeSub.usage.aiRepliesCount || 0) /
        (safeSub.limits.aiRepliesPerMonth || 100)) * 100
    )
  );

  const atLimit = usagePercent >= 100;
  const nearLimit = usagePercent >= 80 && !atLimit;
  const isUnlimited = (safeSub.limits.aiRepliesPerMonth || 0) >= 999999;
  const planName = safeSub.plan
    ? safeSub.plan.charAt(0).toUpperCase() + safeSub.plan.slice(1)
    : "Free";

  return (
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm">

        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">WA AutoBot</span>
          </div>
          <p className="text-xs text-gray-400 mt-1 truncate">
            {business?.name || "No business"}
          </p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = pathname === to;

            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={18} />
                {label}

                {label === "Subscription" && (atLimit || nearLimit) && (
                  <AlertTriangle
                    size={13}
                    className={`ml-auto ${
                      atLimit ? "text-red-500" : "text-amber-500"
                    }`}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ADMIN */}
        {user?.role === "admin" && (
          <div className="mx-4 mb-3">
            <Link
              to="/admin"
              className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-100"
            >
              <Shield size={13} /> Admin Panel
            </Link>
          </div>
        )}

        {/* USER INFO */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2">

            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.name || "Loading..."}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {user?.email || ""}
              </p>
            </div>

            <button onClick={logout}>
              <LogOut size={16} className="text-gray-400 hover:text-red-500" />
            </button>

          </div>
        </div>

      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-auto flex flex-col">

        {atLimit && pathname !== "/subscription" && (
          <div className="bg-red-500 text-white text-xs text-center py-2 px-4">
            AI limit reached — upgrade required
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {children}
        </div>

      </main>
    </div>
  );
}