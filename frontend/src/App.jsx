import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import logo from "./assets/logo.svg";

import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';

import AuthPage from './pages/AuthPage';
import { ForgotPassword, ResetPassword } from './pages/PasswordPages';

import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import Products from './pages/Products';
import { Bookings, Payments } from './pages/BookingsPayments';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Subscription from './pages/Subscription';
import WhatsAppConnect from './pages/WhatsAppConnect';

import AdminOverview from './pages/admin/AdminOverview';
import AdminBusinesses from './pages/admin/AdminBusinesses';
import AdminRevenue from './pages/admin/AdminRevenue';
import AdminSettings from './pages/admin/AdminSettings';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <style>{`
      @keyframes wa-pulse {
        0%   { transform: scale(0.85); opacity: 0.7; }
        50%  { transform: scale(1.05); opacity: 1; }
        100% { transform: scale(0.85); opacity: 0.7; }
      }
      .wa-logo-pulse {
        animation: wa-pulse 1.4s ease-in-out infinite;
      }
    `}</style>
    <img
      src={logo}
      alt="Loading..."
      className="wa-logo-pulse"
      style={{ width: 90, height: 90 }}
    />
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

const wrap = (Component) => (
  <PrivateRoute><Layout><Component /></Layout></PrivateRoute>
);

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"           element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />

      {/* Admin */}
      <Route path="/admin"             element={<AdminRoute><AdminLayout><AdminOverview /></AdminLayout></AdminRoute>} />
      <Route path="/admin/businesses"  element={<AdminRoute><AdminLayout><AdminBusinesses /></AdminLayout></AdminRoute>} />
      <Route path="/admin/revenue"     element={<AdminRoute><AdminLayout><AdminRevenue /></AdminLayout></AdminRoute>} />
      <Route path="/admin/settings"    element={<AdminRoute><AdminLayout><AdminSettings /></AdminLayout></AdminRoute>} />

      {/* Business dashboard */}
      <Route path="/"                element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/conversations"   element={<PrivateRoute><Layout><Conversations /></Layout></PrivateRoute>} />
      <Route path="/products"        element={<PrivateRoute><Layout><Products /></Layout></PrivateRoute>} />
      <Route path="/bookings"        element={<PrivateRoute><Layout><Bookings /></Layout></PrivateRoute>} />
      <Route path="/payments"        element={<PrivateRoute><Layout><Payments /></Layout></PrivateRoute>} />
      <Route path="/analytics"       element={<PrivateRoute><Layout><Analytics /></Layout></PrivateRoute>} />
      <Route path="/subscription"    element={<PrivateRoute><Layout><Subscription /></Layout></PrivateRoute>} />
      <Route path="/settings"        element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
      <Route path="/connect-whatsapp" element={<PrivateRoute><Layout><WhatsAppConnect /></Layout></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
