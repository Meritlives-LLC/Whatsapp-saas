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
      loginWithToken(token);
      navigate('/');
    } else {
      navigate('/auth?error=google_failed');
    }
  }, []);

  return <div className="min-h-screen flex items-center justify-center text-gray-400">Signing you in...</div>;
}