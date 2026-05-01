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
      socketInstance = io(window.location.origin, { withCredentials: true });
    }

    socketInstance.emit('join_business', business._id);

    const handler = (data) => callbackRef.current?.(data);
    socketInstance.on('new_message', handler);

    return () => socketInstance.off('new_message', handler);
  }, [business?._id]);

  return socketInstance;
};
