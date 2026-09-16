import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

/**
 * socket.io-client is loaded by dynamic import so it stays out of the entry
 * chunk (SocketProvider is in the root provider stack, so a static import
 * shipped it to every logged-out marketing visitor).
 *
 * That moved socket creation from synchronous-inside-the-effect to a promise,
 * which is the part worth pinning: consumers key their effects on `socket`, so
 * it has to actually arrive, it has to be the *same* instance for every caller,
 * and a sign-out mid-import must not leave a connection open for the old user.
 */

const connections = [];
const makeFakeSocket = (url, opts) => {
  const handlers = {};
  const socket = {
    url,
    opts,
    connected: false,
    disconnected: false,
    on: vi.fn((e, fn) => { (handlers[e] ??= []).push(fn); }),
    off: vi.fn((e, fn) => {
      if (!fn) handlers[e] = [];
      else handlers[e] = (handlers[e] ?? []).filter((h) => h !== fn);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(() => { socket.disconnected = true; }),
    __fire: (e, ...args) => (handlers[e] ?? []).forEach((h) => h(...args)),
  };
  connections.push(socket);
  return socket;
};

const io = vi.fn(makeFakeSocket);
vi.mock("socket.io-client", () => ({ io: (...a) => io(...a) }));

const storeWith = (userId) =>
  configureStore({
    reducer: { auth: (state = { user: userId ? { _id: userId } : null }) => state },
  });

const wrapper = (userId) =>
  function Wrapper({ children }) {
    return <Provider store={storeWith(userId)}>{children}</Provider>;
  };

let useSocket;
beforeEach(async () => {
  vi.resetModules();
  connections.length = 0;
  io.mockClear();
  // re-import so the module-level socket singleton starts empty each test
  useSocket = (await import("@shared/realtime/useSocket")).default;
});
afterEach(() => vi.clearAllMocks());

describe("useSocket", () => {
  it("does not load socket.io for a logged-out visitor", async () => {
    const { result } = renderHook(() => useSocket(), { wrapper: wrapper(null) });
    await Promise.resolve();
    expect(io).not.toHaveBeenCalled();
    expect(result.current.socket).toBeNull();
  });

  it("connects once the user id is known, and exposes the socket", async () => {
    const { result } = renderHook(() => useSocket(), { wrapper: wrapper("u1") });
    await waitFor(() => expect(result.current.socket).not.toBeNull());
    expect(io).toHaveBeenCalledTimes(1);
    expect(io.mock.calls[0][1]).toEqual({ query: { userId: "u1" } });
  });

  it("shares one connection across concurrent consumers", async () => {
    const w = wrapper("u1");
    const a = renderHook(() => useSocket(), { wrapper: w });
    const b = renderHook(() => useSocket(), { wrapper: w });
    await waitFor(() => {
      expect(a.result.current.socket).not.toBeNull();
      expect(b.result.current.socket).not.toBeNull();
    });
    expect(io).toHaveBeenCalledTimes(1);
    expect(a.result.current.socket).toBe(b.result.current.socket);
  });

  it("reports connection state and announces the user on connect", async () => {
    const { result } = renderHook(() => useSocket(), { wrapper: wrapper("u1") });
    await waitFor(() => expect(result.current.socket).not.toBeNull());
    expect(result.current.isConnected).toBe(false);

    act(() => connections[0].__fire("connect"));
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(connections[0].emit).toHaveBeenCalledWith("userOnline", "u1");

    act(() => connections[0].__fire("disconnect"));
    await waitFor(() => expect(result.current.isConnected).toBe(false));
  });

  it("drops the old connection when the user changes", async () => {
    const first = renderHook(() => useSocket(), { wrapper: wrapper("u1") });
    await waitFor(() => expect(first.result.current.socket).not.toBeNull());
    first.unmount();

    const second = renderHook(() => useSocket(), { wrapper: wrapper("u2") });
    await waitFor(() => expect(second.result.current.socket).not.toBeNull());

    expect(io).toHaveBeenCalledTimes(2);
    expect(connections[0].disconnect).toHaveBeenCalled();
    expect(io.mock.calls[1][1]).toEqual({ query: { userId: "u2" } });
  });

  it("detaches its listeners on unmount", async () => {
    const { result, unmount } = renderHook(() => useSocket(), { wrapper: wrapper("u1") });
    await waitFor(() => expect(result.current.socket).not.toBeNull());
    const socket = connections[0];
    unmount();
    expect(socket.off).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("disconnect", expect.any(Function));
  });
});
