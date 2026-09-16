import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { BACKEND_API_URL } from "@shared/api/url";

// Module-level singleton. Without this, every component that calls useSocket()
// gets its own useState(null), making !socket true on first render in each
// component — so each independently calls io() and creates a duplicate connection.
let _socket = null;
let _socketUserId = null;

// socket.io-client is imported dynamically, not at module scope. SocketProvider
// sits in the root provider stack, so a static import put socket.io + engine.io
// in the entry chunk and shipped them to every logged-out visitor on the
// marketing pages — where io() is never called, because it needs a user id.
//
// The import promise is cached rather than the module: two components mounting
// in the same tick must not start two downloads.
let _ioPromise = null;
const loadIo = () => (_ioPromise ??= import('socket.io-client').then((m) => m.io));

// The in-flight creation, shared by every caller asking for the same user.
// Caching only the import is not enough: two components mounting in the same
// tick both see `_socket === null`, both pass the guard, and both call io() once
// the module lands — two connections, with the first one leaked. Synchronous
// code could not hit this, which is why the original did not guard against it.
let _pending = null;

function getOrCreateSocket(userId) {
  if (_socket && _socketUserId === userId) return Promise.resolve(_socket);
  if (_pending && _pending.userId === userId) return _pending.promise;

  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  _socketUserId = userId;

  const promise = loadIo()
    .then((io) => {
      // Awaiting yields to the event loop, so the user may have changed
      // (sign-out, or an account switch) while the chunk was in flight. Without
      // this the losing call would open a connection for the wrong user.
      if (_socketUserId !== userId) return null;
      _socket = io(BACKEND_API_URL, { query: { userId } });
      return _socket;
    })
    .finally(() => {
      if (_pending && _pending.userId === userId) _pending = null;
    });

  _pending = { userId, promise };
  return promise;
}

const useSocket = () => {
  const { user } = useSelector((state) => state.auth);
  const userId = user?._id;

  // Seeded synchronously so a component mounting after the connection already
  // exists gets it on its first render, rather than flashing through null and
  // re-running every consumer effect that depends on `socket`.
  const [socket, setSocket] = useState(() =>
    _socket && _socketUserId === userId ? _socket : null,
  );
  const [isConnected, setIsConnected] = useState(() => _socket?.connected ?? false);

  useEffect(() => {
    if (!userId) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    let cancelled = false;
    let active = null;

    const onConnect = () => {
      setIsConnected(true);
      active?.emit('userOnline', userId);
    };
    const onDisconnect = () => setIsConnected(false);

    getOrCreateSocket(userId).then((s) => {
      if (cancelled || !s) return;
      active = s;
      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      // Publishing the socket is what re-runs the consumer effects that are
      // keyed on it — every caller guards with `if (!socket) return` and lists
      // it as a dependency, so this is the signal that wires them up.
      setSocket(s);

      if (s.connected) {
        setIsConnected(true);
        s.emit('userOnline', userId);
      }
    });

    return () => {
      cancelled = true;
      active?.off('connect', onConnect);
      active?.off('disconnect', onDisconnect);
    };
  }, [userId]);

  return { socket: userId ? socket : null, isConnected };
};

export default useSocket;
