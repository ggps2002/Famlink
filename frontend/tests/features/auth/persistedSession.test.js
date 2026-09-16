import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStoredState } from "redux-persist";
import storage from "redux-persist/lib/storage";
import {
  authPersistTransform,
  discardStoredTokens,
} from "@features/auth/store/persistedUser";

/**
 * What comes back off disk when the app boots.
 *
 * Driven through redux-persist's own `getStoredState` rather than by calling the
 * transforms directly, because the bug this guards against lives in the seam
 * between them: `whitelist` is consulted by `createPersistoid` when WRITING and
 * by nothing at all when reading, so a key dropped from the whitelist keeps
 * being rehydrated out of every browser that still has an older copy of the
 * blob. Testing the transform alone would not have caught that.
 */

const PERSIST_KEY = "persist:auth";

const config = {
  key: "auth",
  storage,
  transforms: [authPersistTransform, discardStoredTokens],
};

/** The blob as it exists today in a signed-in member's browser. */
const writeLegacyBlob = () => {
  window.localStorage.setItem(
    PERSIST_KEY,
    JSON.stringify({
      user: JSON.stringify({ _id: "user-1", name: "Sam", type: "Nanny" }),
      accessToken: JSON.stringify("token-from-before-the-migration"),
      refreshToken: JSON.stringify("seven-day-credential"),
      accessTokenExpiry: JSON.stringify(1893456000),
      refreshTokenExpiry: JSON.stringify(1893456000),
      _persist: JSON.stringify({ version: -1, rehydrated: true }),
    })
  );
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("rehydrating a session that predates the cookie migration", () => {
  it("brings back no tokens", async () => {
    writeLegacyBlob();

    const state = await getStoredState(config);

    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it("brings back no stale expiries either", async () => {
    // A rehydrated `accessTokenExpiry` would send PageLayout looking for a
    // token that is not there, by a different route than the boot restore.
    writeLegacyBlob();

    const state = await getStoredState(config);

    expect(state.accessTokenExpiry).toBeNull();
    expect(state.refreshTokenExpiry).toBeNull();
  });

  it("still brings back the user shell", async () => {
    // Without it a reload flashes a logged-out page while the session is being
    // restored, which is the only reason anything is persisted at all.
    writeLegacyBlob();

    const state = await getStoredState(config);

    expect(state.user._id).toBe("user-1");
    expect(state.user.type).toBe("Nanny");
  });

  it("leaves the boot restore looking at a cold start", async () => {
    // This is the behaviour that matters: with no token in hand,
    // `restoreSession` goes to the server for a real one. If a stale token came
    // back instead it would skip, run on a credential with no cookie behind it,
    // and drop the member mid-session up to two hours later.
    writeLegacyBlob();

    const state = await getStoredState(config);

    expect(state.accessToken).toBeFalsy();
    expect(state.user._id).toBeTruthy();
  });
});

describe("the trap the guard exists for", () => {
  it("hands the token straight back when the transform is absent", () => {
    // Not a test of our code but of the assumption underneath it, and it is the
    // assumption that is easy to get wrong: dropping a key from `whitelist`
    // reads like it stops being loaded, and it does not. If a future
    // redux-persist makes this assertion fail, `discardStoredTokens` has become
    // redundant rather than wrong — but until then it is the only thing
    // standing between an old blob and a live session field.
    const whitelistOnly = { key: "auth", storage, transforms: [authPersistTransform] };
    writeLegacyBlob();

    return getStoredState(whitelistOnly).then((state) => {
      expect(state.accessToken).toBe("token-from-before-the-migration");
      expect(state.refreshToken).toBe("seven-day-credential");
    });
  });
});

describe("the store's persist configuration", () => {
  const source = fs.readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../src/app/store.js"
    ),
    "utf8"
  );

  it("persists the user shell and nothing else", () => {
    // Read from the source because the assertion is about the configuration
    // itself: importing the module would build the whole store and start a
    // session restore as a side effect.
    const whitelist = source.match(/whitelist:\s*\[([^\]]*)\]/)?.[1] ?? "";

    expect(whitelist).toContain("user");
    expect(whitelist).not.toMatch(/accessToken|refreshToken/);
  });

  it("applies the transform that keeps stored tokens out of the store", () => {
    // The whitelist above stops them being written; only this stops the ones
    // already written from being read back.
    expect(source).toMatch(/transforms:\s*\[[^\]]*discardStoredTokens/);
  });
});
