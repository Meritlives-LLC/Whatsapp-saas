import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function GoogleSuccess() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    if (token) {
      // loginWithToken sets the token + awaits /auth/me before we navigate,
      // so user is populated in context before PrivateRoute checks it.
      loginWithToken(token).then(() => navigate('/', { replace: true }));
    } else {
      navigate('/login?error=google_failed', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400">
      <div className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">Signing you in...</span>
    </div>
  );
}