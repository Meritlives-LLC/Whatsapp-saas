import { BrowserRouter, Routes, Route, Navigate, useLocation  } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import AdminOverview from './pages/admin/AdminOverview';
import AdminBusinesses from './pages/admin/AdminBusinesses';
import AdminRevenue from './pages/admin/AdminRevenue';
import AdminSettings from './pages/admin/AdminSettings';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
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

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"          element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />

      {/* Admin */}
      <Route path="/admin" element={<AdminRoute><AdminLayout><AdminOverview /></AdminLayout></AdminRoute>} />
      <Route path="/admin/businesses" element={<AdminRoute><AdminLayout><AdminBusinesses /></AdminLayout></AdminRoute>} />
      <Route path="/admin/revenue"    element={<AdminRoute><AdminLayout><AdminRevenue /></AdminLayout></AdminRoute>} />
      <Route path="/admin/settings"   element={<AdminRoute><AdminLayout><AdminSettings /></AdminLayout></AdminRoute>} />

      {/* Business dashboard */}
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/"              element={<Dashboard />} />
              <Route path="/conversations" element={<Conversations />} />
              <Route path="/products"      element={<Products />} />
              <Route path="/bookings"      element={<Bookings />} />
              <Route path="/payments"      element={<Payments />} />
              <Route path="/analytics"     element={<Analytics />} />
              <Route path="/subscription"  element={<Subscription />} />
              <Route path="/settings"      element={<Settings />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
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
