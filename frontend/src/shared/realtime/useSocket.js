import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { BACKEND_API_URL } from "@shared/api/url";

// Module-level singleton. Without this, every component that calls useSocket()
// gets its own useState(null), making !socket true on first render in each
// component — so each independently calls io() and creates a duplicate connection.
let _socket = null;
let _socketUserId = null;

function getOrCreateSocket(userId) {
  if (_socket && _socketUserId === userId) return _socket;
  if (_socket) _socket.disconnect();
  _socketUserId = userId;
  _socket = io(BACKEND_API_URL, { query: { userId } });
  return _socket;
}

const useSocket = () => {
  const { user } = useSelector((state) => state.auth);
  const userId = user?._id;
  const [isConnected, setIsConnected] = useState(() => _socket?.connected ?? false);

  useEffect(() => {
    if (!userId) return;

    const socket = getOrCreateSocket(userId);

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('userOnline', userId);
    };
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      setIsConnected(true);
      socket.emit('userOnline', userId);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [userId]);

  return { socket: userId ? _socket : null, isConnected };
};

export default useSocket;
