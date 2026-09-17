import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

let socketInstance = null;

export const useSocket = (onMessage) => {
  const { business } = useAuth();
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    if (!business?._id) return;

    if (!socketInstance) {
      socketInstance = io(import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin, {
        withCredentials: true,
        // The server verifies this JWT during the handshake and resolves
        // the caller's own business id itself — it is never told which
        // business's room to join. Re-read on every (re)connect attempt
        // so a refreshed access token is picked up automatically.
        auth: (cb) => cb({ token: localStorage.getItem('token') }),
      });
    }

    const handler = (data) => callbackRef.current?.(data);
    socketInstance.on('new_message', handler);

    return () => socketInstance.off('new_message', handler);
  }, [business?._id]);

  return socketInstance;
};
