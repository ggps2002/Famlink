import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

vi.mock("@features/auth/api/AuthService", () => ({
  authService: {
    refreshToken: vi.fn(),
    logout: vi.fn().mockResolvedValue({ data: {}, status: 200 }),
  },
}));

const { authService } = await import("@features/auth/api/AuthService");
const { default: authReducer, refreshTokenThunk, logoutThunk } = await import(
  "@features/auth/store/authSlice"
);
const { restoreSession } = await import("@features/auth/store/restoreSession");

const SESSION = {
  data: {
    user: { _id: "user-1", name: "Sam", type: "Nanny" },
    accessToken: "new-access-token",
    accessTokenExpiry: 1893456000,
    refreshTokenExpiry: 1893456000,
  },
  status: 200,
};

const storeWith = (auth) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: auth ? { auth } : undefined,
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  });

/** A slice as redux-persist rehydrates it: the user shell, and no tokens. */
const rehydrated = (over = {}) => ({
  isLoading: false,
  user: { _id: "user-1", name: "Sam", type: "Nanny" },
  accessToken: null,
  accessTokenExpiry: null,
  refreshTokenExpiry: null,
  ...over,
});

const rejectedWith = (status) =>
  Object.assign(new Error("nope"), {
    response: { status, data: { message: "Invalid or expired token" } },
  });

beforeEach(() => {
  vi.clearAllMocks();
  authService.refreshToken.mockResolvedValue(SESSION);
});

describe("refreshTokenThunk", () => {
  it("shares one request between concurrent callers", async () => {
    // Refreshing ROTATES the token: the server replaces the stored row, so the
    // second of two concurrent calls presents one that has already been
    // superseded and gets a 401 — which the response interceptor reads as the
    // end of the session and signs the member out. Nine components dispatch
    // this on mount, so a reload would meet that every time.
    const store = storeWith(rehydrated());

    let release;
    authService.refreshToken.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(SESSION);
      })
    );

    const both = Promise.all([
      store.dispatch(refreshTokenThunk()),
      store.dispatch(refreshTokenThunk()),
    ]);
    release();
    await both;

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.accessToken).toBe("new-access-token");
  });

  it("starts a new request once the shared one has settled", async () => {
    // Sharing must not become caching — the next renewal has to actually renew.
    const store = storeWith(rehydrated());

    await store.dispatch(refreshTokenThunk());
    await store.dispatch(refreshTokenThunk());

    expect(authService.refreshToken).toHaveBeenCalledTimes(2);
  });

  it("keeps no copy of the refresh token in the store", async () => {
    // It is in an httpOnly cookie. Anything holding a second copy here is a
    // copy that ends up back in localStorage the next time the whitelist grows.
    const store = storeWith(rehydrated());

    await store.dispatch(refreshTokenThunk());

    expect(store.getState().auth.refreshToken).toBeUndefined();
  });
});

describe("restoreSession", () => {
  it("trades the cookie for an access token when a user was signed in", async () => {
    const store = storeWith(rehydrated());

    await restoreSession(store);

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.accessToken).toBe("new-access-token");
  });

  it("does nothing for a visitor who was never signed in", async () => {
    // Otherwise every marketing page view spends a request that can only 401.
    const store = storeWith(rehydrated({ user: { _id: "" } }));

    await restoreSession(store);

    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it("does nothing when a token is already in hand", async () => {
    // This is a fresh sign-in, not a reload. Refreshing would rotate a session
    // that is seconds old for no reason.
    const store = storeWith(rehydrated({ accessToken: "just-logged-in" }));

    await restoreSession(store);

    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it("clears the persisted user when there is no cookie to renew", async () => {
    // The commonest failure by far, and the one that was wrong: with no cookie
    // there is no credential to reject, so the server answers 400
    // `No token provided` rather than 401. Treating that as transient left the
    // member rendered as signed-in holding no token.
    authService.refreshToken.mockRejectedValue(rejectedWith(400));
    const store = storeWith(rehydrated());

    await restoreSession(store);

    expect(store.getState().auth.user._id).toBe("");
  });

  it("clears the persisted user when the server says the session is over", async () => {
    // A 401 is definitive: the cookie is gone, expired or revoked, and the
    // persisted user is the last trace of a session that no longer exists.
    authService.refreshToken.mockRejectedValue(rejectedWith(401));
    const store = storeWith(rehydrated());

    await restoreSession(store);

    expect(store.getState().auth.user._id).toBe("");
  });

  it("leaves the session alone when the API is merely unreachable", async () => {
    // Signing everyone out during a blip is a far worse failure than waiting.
    // A 502 is not evidence that anybody's session ended.
    authService.refreshToken.mockRejectedValue(rejectedWith(502));
    const store = storeWith(rehydrated());

    await restoreSession(store);

    expect(store.getState().auth.user._id).toBe("user-1");
  });
});

describe("logoutThunk", () => {
  it("asks the server to end the session, then clears the slice", async () => {
    // The cookie is httpOnly, so this is the only thing that can remove it.
    const store = storeWith(rehydrated({ accessToken: "token" }));

    await store.dispatch(logoutThunk());

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.accessToken).toBeNull();
    expect(store.getState().auth.user._id).toBe("");
  });

  it("still signs the member out locally when the request fails", async () => {
    // Someone trying to leave must not be held on the page by a network error.
    authService.logout.mockRejectedValue(new Error("offline"));
    const store = storeWith(rehydrated({ accessToken: "token" }));

    await store.dispatch(logoutThunk());

    expect(store.getState().auth.accessToken).toBeNull();
  });
});
