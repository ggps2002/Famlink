import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, setSessionGate, setAccessTokenReader } from "@shared/api/client";

/**
 * The two mechanisms that keep a reload working now that the access token is
 * held in memory only.
 *
 * Both failures they prevent are invisible in a passing build and only appear
 * against a real server: requests racing ahead of the session restore, and
 * concurrent refreshes rotating each other's token away.
 */

/** Replaces the network, and reports what the interceptors did to the config. */
const captureRequests = () => {
  const sent = [];
  api.defaults.adapter = async (config) => {
    sent.push(config);
    return { data: {}, status: 200, statusText: "OK", headers: {}, config };
  };
  return sent;
};

/** Lets anything the gate released actually reach the adapter. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the session gate", () => {
  beforeEach(() => {
    setAccessTokenReader(() => undefined);
    setSessionGate(Promise.resolve());
  });

  it("holds a request until the session has been restored", async () => {
    // Without this, the requests a dashboard fires as it mounts go out before
    // the refresh cookie has been traded for an access token — and they are
    // precisely the ones PageLayout's 401 interceptor is not yet installed to
    // retry, because a parent's effects run after its children's.
    const sent = captureRequests();

    let openGate;
    setSessionGate(new Promise((resolve) => {
      openGate = resolve;
    }));

    const inFlight = api.get("/referral/me");
    await flush();

    expect(sent).toHaveLength(0);

    setAccessTokenReader(() => "restored-token");
    openGate();
    await inFlight;

    expect(sent).toHaveLength(1);
    expect(sent[0].headers.Authorization).toBe("Bearer restored-token");
  });

  it("reads the token after the gate, not before", async () => {
    // The token does not exist when the request is made — it is what the
    // restore produces. Reading it early would attach nothing and 401.
    const sent = captureRequests();

    let openGate;
    setSessionGate(new Promise((resolve) => {
      openGate = resolve;
    }));

    let token;
    setAccessTokenReader(() => token);

    const inFlight = api.get("/anything");
    await flush();

    token = "arrived-late";
    openGate();
    await inFlight;

    expect(sent[0].headers.Authorization).toBe("Bearer arrived-late");
  });

  it("lets the refresh call itself through", async () => {
    // The refresh IS the restore. Making it wait for the gate would leave it
    // waiting for its own result, and nothing in the app would ever send again.
    const sent = captureRequests();

    setSessionGate(new Promise(() => {}));

    await api.post("/auth/refreshToken", null, { skipSessionGate: true });

    expect(sent).toHaveLength(1);
  });

  it("opens on its own if the restore never settles", async () => {
    // A gate that can never open turns a recoverable failure — storage
    // unavailable, a rehydration callback that does not fire — into an app
    // where no request ever leaves.
    vi.useFakeTimers();

    try {
      const sent = captureRequests();
      setSessionGate(new Promise(() => {}));

      const inFlight = api.get("/anything");
      await vi.advanceTimersByTimeAsync(10000);
      await inFlight;

      expect(sent).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
