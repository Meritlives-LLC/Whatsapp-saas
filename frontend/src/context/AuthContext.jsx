import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---------------- HYDRATE AUTH ----------------
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          setLoading(false);
          return;
        }

        const { data } = await api.get('/auth/me');

        if (!data?.user) {
          throw new Error('Invalid auth response');
        }

        setUser(data.user || null);
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

  // ---------------- LOGIN ----------------
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });

    if (!data?.token || !data?.user) {
      throw new Error('Invalid login response');
    }

    localStorage.setItem('token', data.token);

    setUser(data.user);
    setBusiness(data.business || null);

    return data;
  };

  // ---------------- REGISTER ----------------
  const register = async (name, email, password, businessName) => {
    const { data } = await api.post('/auth/register', {
      name,
      email,
      password,
      businessName,
    });

    if (!data?.token || !data?.user) {
      throw new Error('Invalid register response');
    }

    localStorage.setItem('token', data.token);

    setUser(data.user);
    setBusiness(data.business || null);

    return data;
  };

  // ---------------- LOGOUT ----------------
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setBusiness(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);