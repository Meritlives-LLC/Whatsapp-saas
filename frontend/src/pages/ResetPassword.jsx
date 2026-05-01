import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Zap, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import api from '../utils/api';

const Rule = ({ met, text }) => (
  <div className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
    {met ? <CheckCircle size={11} /> : <XCircle size={11} />} {text}
  </div>
);

export default function ResetPassword() {
  const { token }       = useParams();
  const navigate        = useNavigate();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const rules = {
    length:  password.length >= 8,
    upper:   /[A-Z]/.test(password),
    lower:   /[a-z]/.test(password),
    number:  /\d/.test(password),
  };
  const allMet = Object.values(rules).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allMet) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
              <Zap size={22} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">WA AutoBot</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={30} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password reset!</h2>
              <p className="text-sm text-gray-500">Redirecting you to login in 3 seconds...</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Set new password</h2>
              <p className="text-sm text-gray-400 mb-6">Choose a strong password for your account.</p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="New password"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 pr-10" />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {password && (
                  <div className="grid grid-cols-2 gap-1.5 p-3 bg-gray-50 rounded-xl">
                    <Rule met={rules.length} text="8+ characters" />
                    <Rule met={rules.upper}  text="Uppercase letter" />
                    <Rule met={rules.lower}  text="Lowercase letter" />
                    <Rule met={rules.number} text="Number" />
                  </div>
                )}

                <button type="submit" disabled={loading || !allMet}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
              <Link to="/login" className="mt-4 text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
