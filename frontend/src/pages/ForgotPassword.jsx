import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import logo from '../assets/logo.svg';

export default function ForgotPassword() {
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
      setError(err.response?.data?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
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

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={30} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If <strong>{email}</strong> is registered, we've sent a password reset link.
                It expires in 15 minutes.
              </p>
              <p className="text-xs text-gray-400 mb-4">Didn't get it? Check your spam folder.</p>
              <Link to="/login" className="text-sm text-green-600 font-semibold hover:underline flex items-center justify-center gap-1">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Forgot your password?</h2>
              <p className="text-sm text-gray-400 mb-6">Enter your email and we'll send a reset link.</p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <Link to="/login" className="mt-5 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
                <ArrowLeft size={13} /> Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
