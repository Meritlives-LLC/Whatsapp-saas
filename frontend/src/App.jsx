import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import React from 'react';

import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';

import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage.jsx';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import GoogleSuccess from './pages/GoogleSuccess';

import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import Products from './pages/Products';
import { Bookings, Payments } from './pages/BookingsPayments';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Subscription from './pages/Subscription';
import SubscriptionPage from './pages/SubscriptionPage';
import WhatsAppConnect from './pages/WhatsAppConnect';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Pricing from './pages/Pricing';

import AdminOverview from './pages/admin/AdminOverview';
import AdminBusinesses from './pages/admin/AdminBusinesses';
import AdminRevenue from './pages/admin/AdminRevenue';
import AdminSettings from './pages/admin/AdminSettings';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Something went wrong</h1>
          <p className="text-gray-500 mb-6 max-w-md">
            An unexpected error occurred. Your data is safe — please reload the page to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

// Root route: show spinner while auth loads, then branch on user
const RootRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Layout><Dashboard /></Layout>;
  return <LandingPage />;
};

function AppRoutes() {
  const { user, loading } = useAuth();

  // Block ALL route rendering until auth is resolved.
  // Without this, navigating to "/" after Google OAuth lands on LandingPage
  // because user is still null while loginWithToken is mid-flight.
  if (loading) return <Spinner />;

  return (
    <Routes>
      {/* Landing page — public */}
      <Route path="/home" element={user ? <Navigate to="/" replace /> : <LandingPage />} />

      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/pricing"         element={<Pricing />} />

      {/* Auth — public */}
      <Route path="/login"                     element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/forgot-password"           element={<ForgotPassword />} />
      <Route path="/reset-password/:token"     element={<ResetPassword />} />
      {/* Google OAuth lands here — must be public, no PrivateRoute wrapper */}
      <Route path="/auth/google/success"       element={<GoogleSuccess />} />

      {/* Admin */}
      <Route path="/admin"            element={<AdminRoute><AdminLayout><AdminOverview /></AdminLayout></AdminRoute>} />
      <Route path="/admin/businesses" element={<AdminRoute><AdminLayout><AdminBusinesses /></AdminLayout></AdminRoute>} />
      <Route path="/admin/revenue"    element={<AdminRoute><AdminLayout><AdminRevenue /></AdminLayout></AdminRoute>} />
      <Route path="/admin/settings"   element={<AdminRoute><AdminLayout><AdminSettings /></AdminLayout></AdminRoute>} />

      {/* Root: spinner → dashboard or landing */}
      <Route path="/" element={<RootRoute />} />

      {/* Business dashboard */}
      <Route path="/conversations"    element={<PrivateRoute><Layout><Conversations /></Layout></PrivateRoute>} />
      <Route path="/products"         element={<PrivateRoute><Layout><Products /></Layout></PrivateRoute>} />
      <Route path="/bookings"         element={<PrivateRoute><Layout><Bookings /></Layout></PrivateRoute>} />
      <Route path="/payments"         element={<PrivateRoute><Layout><Payments /></Layout></PrivateRoute>} />
      <Route path="/analytics"        element={<PrivateRoute><Layout><Analytics /></Layout></PrivateRoute>} />
      <Route path="/subscription"     element={<PrivateRoute><Layout><Subscription /></Layout></PrivateRoute>} />
      <Route path="/subscription/manage" element={<PrivateRoute><Layout><SubscriptionPage /></Layout></PrivateRoute>} />
      <Route path="/settings"         element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
      <Route path="/connect-whatsapp" element={<PrivateRoute><Layout><WhatsAppConnect /></Layout></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}