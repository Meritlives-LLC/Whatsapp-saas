import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]         = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading]   = useState(true);

  // ── Hydrate auth on page load ─────────────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setLoading(false); return; }

        const { data } = await api.get('/auth/me');
        if (!data?.user) throw new Error('Invalid auth response');

        setUser(data.user);
        setBusiness(data.business || null);
      } catch (err) {
        console.log('Auth failed:', err.message);
        localStorage.removeItem('token');
        setUser(null);
        setBusiness(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (!data?.token || !data?.user) throw new Error('Invalid login response');

    localStorage.setItem('token', data.token);
    setUser(data.user);
    setBusiness(data.business || null);
    return data;
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const register = async (name, email, password, businessName) => {
    const { data } = await api.post('/auth/register', { name, email, password, businessName });
    if (!data?.token || !data?.user) throw new Error('Invalid register response');

    localStorage.setItem('token', data.token);
    setUser(data.user);
    setBusiness(data.business || null);
    return data;
  };

  // ── Login with token (Google OAuth) ──────────────────────────────────────
  // Returns a Promise so GoogleSuccess.jsx can await it before navigating.
  // Navigation must happen AFTER user is set — otherwise PrivateRoute sees
  // null and bounces to /login before the /auth/me response arrives.
  const loginWithToken = async (token) => {
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    setBusiness(data.business || null);
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setBusiness(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, business, loading, login, register, logout, loginWithToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);