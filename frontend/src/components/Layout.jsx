import {
  LayoutDashboard, MessageSquare, Package, Calendar,
  CreditCard, Settings, LogOut, Zap, BarChart2, Star,
  Wifi, AlertTriangle, Shield, Menu, X
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import logo from "../assets/logo.svg";

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/connect-whatsapp', icon: Wifi, label: 'Connect WhatsApp' },
  { to: '/subscription', icon: Star, label: 'Subscription' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

// Items shown in mobile bottom bar (most used)
const bottomNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/conversations', icon: MessageSquare, label: 'Chats' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/subscription', icon: Star, label: 'Plan' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }) {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, business, logout } = useAuth();
  const [sub, setSub] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (business?._id) {
      api.get('/subscription')
        .then(({ data }) => setSub(data.data))
        .catch(() => {});
    }
  }, [business?._id]);

  const safeSub = sub || { usage: { aiRepliesCount: 0 }, limits: { aiRepliesPerMonth: 100 }, plan: "free" };
  const usagePercent = Math.min(100, Math.round(((safeSub.usage.aiRepliesCount || 0) / (safeSub.limits.aiRepliesPerMonth || 100)) * 100));
  const atLimit = usagePercent >= 100;
  const nearLimit = usagePercent >= 80 && !atLimit;
  const isUnlimited = (safeSub.limits.aiRepliesPerMonth || 0) >= 999999;

  const SidebarContent = () => (
    <>
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
            <img src={logo} alt="logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-gray-900 text-lg">WA AutoBot</span>
        </div>
        {/* Close button — mobile only */}
        <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>
      <p className="text-xs text-gray-400 px-6 py-2 truncate border-b border-gray-50">{business?.name || "No business"}</p>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}>
              <Icon size={18} />
              {label}
              {label === 'Connect WhatsApp' && (
                <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              )}
              {label === "Subscription" && (atLimit || nearLimit) && (
                <AlertTriangle size={13} className={`ml-auto ${atLimit ? "text-red-500" : "text-amber-500"}`} />
              )}
            </Link>
          );
        })}
      </nav>

      {user?.role === "admin" && (
        <div className="mx-4 mb-3">
          <Link to="/admin"
            className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-100">
            <Shield size={13} /> Admin Panel
          </Link>
        </div>
      )}

      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "Loading..."}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email || ""}</p>
          </div>
          <button onClick={logout}><LogOut size={16} className="text-gray-400 hover:text-red-500" /></button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-100 flex-col shadow-sm">
        <SidebarContent />
      </aside>

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center">
              <img src={logo} alt="logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-gray-900">WA AutoBot</span>
          </div>
        </div>

        {atLimit && pathname !== "/subscription" && (
          <div className="bg-red-500 text-white text-xs text-center py-2 px-4">
            AI limit reached — <Link to="/subscription" className="underline font-semibold">upgrade required</Link>
          </div>
        )}

        {/* Page content — add bottom padding on mobile for bottom nav */}
        <div className="flex-1 overflow-auto pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {bottomNavItems.map(({ to, icon: Icon, label }) => {
            const active = pathname === to;
            const showWarning = to === '/subscription' && (atLimit || nearLimit);
            return (
              <Link key={to} to={to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors relative ${
                  active ? "text-green-600" : "text-gray-400"
                }`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                {showWarning && (
                  <span className={`absolute top-1 right-2 w-2 h-2 rounded-full ${atLimit ? 'bg-red-500' : 'bg-amber-400'}`} />
                )}
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}