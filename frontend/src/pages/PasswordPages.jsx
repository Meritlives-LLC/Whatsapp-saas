import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowLeft, Mail, Eye, EyeOff, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import logo from '../assets/logo.svg';

const Card = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4 font-sans">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-3">
          <img
            src={logo}
            alt="WA AutoBot Logo"
            className="w-10 h-10 object-contain"
          />
          <span className="text-2xl font-bold text-gray-900">WA AutoBot</span>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-xl p-8">{children}</div>
    </div>
  </div>
);

// ── Forgot Password ───────────────────────────────────────────────────────────
export function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      {sent ? (
        <div className="text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
          <p className="text-gray-500 text-sm mb-6">
            If <strong>{email}</strong> is registered, a reset link has been sent. Check your inbox (and spam folder).
          </p>
          <Link to="/login" className="text-green-600 font-semibold text-sm hover:underline flex items-center justify-center gap-1">
            <ArrowLeft size={14} /> Back to login
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Forgot password?</h2>
          <p className="text-gray-400 text-sm mb-6">Enter your email and we'll send a reset link.</p>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          <Link to="/login" className="mt-5 text-green-600 font-semibold text-sm hover:underline flex items-center justify-center gap-1">
            <ArrowLeft size={14} /> Back to login
          </Link>
        </>
      )}
    </Card>
  );
}

// ── Reset Password ────────────────────────────────────────────────────────────
export function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token');
  const [form, setForm]         = useState({ password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm)
      return setError('Passwords do not match');
    if (form.password.length < 8)
      return setError('Password must be at least 8 characters');
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
      return setError('Must include uppercase, lowercase and a number');

    setLoading(true);
    setError('');
    try {
      await api.patch(`/auth/reset-password/${token}`, { password: form.password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      {done ? (
        <div className="text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Password updated!</h2>
          <p className="text-gray-500 text-sm mb-6">Your password has been reset successfully.</p>
          <Link to="/login"
            className="block w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl text-center text-sm transition-colors">
            Login with new password →
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Set new password</h2>
          <p className="text-gray-400 text-sm mb-6">Must be 8+ characters with uppercase, lowercase, and a number.</p>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} required value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="New password"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 pr-10" />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <input type="password" required value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Confirm new password"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </>
      )}
    </Card>
  );
}
