import { describe, it, expect } from "vitest";
import { Database } from "#src/core/database/Database.js";

const REMOTE = "mongodb+srv://user:secret@cluster0.abc.mongodb.net/famylink";
const LOCAL = "mongodb://127.0.0.1:27017/famylink";

/**
 * The guard runs before any socket is opened, so every case below is hermetic —
 * nothing here reaches the network.
 *
 * config/index.js already resolves a local URI for development. This is the
 * backstop for the paths that skip it: a script doing `new Database({ uri })`,
 * a migration, a fixture. Those are where a connection to production is both
 * most likely and most costly.
 */

describe("Database refuses a remote database outside production", () => {
  it("throws rather than connecting", async () => {
    const database = new Database({ uri: REMOTE, env: "development" });

    await expect(database.connect()).rejects.toThrow(/Refusing to connect/);
  });

  it("names the host but never the credentials", async () => {
    const database = new Database({ uri: REMOTE, env: "development" });

    const error = await database.connect().catch((e) => e);

    expect(error.message).toContain("cluster0.abc.mongodb.net");
    expect(error.message).not.toContain("secret");
  });

  it("says how to fix it", async () => {
    // An error that only forbids costs the reader a trip to the source.
    const database = new Database({ uri: REMOTE, env: "development" });

    const error = await database.connect().catch((e) => e);

    expect(error.message).toMatch(/db:up/);
    expect(error.message).toMatch(/MONGO_DB_URI_DEV/);
    expect(error.message).toMatch(/ALLOW_REMOTE_DB/);
  });

  it("applies in test as well as development", async () => {
    // The suite runs with NODE_ENV=test. A fixture pointed at the real cluster
    // would be worse than one pointed at a dev database, not better.
    const database = new Database({ uri: REMOTE, env: "test" });

    await expect(database.connect()).rejects.toThrow(/Refusing to connect/);
  });

  it("lets a local URI through the guard", async () => {
    // Asserted by what the guard does NOT do: reaching the connection attempt
    // is the pass condition. The connection itself is not this test's business.
    const database = new Database({
      uri: LOCAL,
      env: "development",
      options: { serverSelectionTimeoutMS: 1 },
    });

    const error = await database.connect().catch((e) => e);

    expect(error?.message ?? "").not.toMatch(/Refusing to connect/);
    await database.disconnect();
  });

  it("stands aside when the caller opts in", async () => {
    const database = new Database({
      uri: REMOTE,
      env: "development",
      allowRemote: true,
      options: { serverSelectionTimeoutMS: 1 },
    });

    const error = await database.connect().catch((e) => e);

    expect(error?.message ?? "").not.toMatch(/Refusing to connect/);
    await database.disconnect();
  });

  it("stands aside in production, where the remote database is the point", async () => {
    const database = new Database({
      uri: REMOTE,
      env: "production",
      options: { serverSelectionTimeoutMS: 1 },
    });

    const error = await database.connect().catch((e) => e);

    expect(error?.message ?? "").not.toMatch(/Refusing to connect/);
    await database.disconnect();
  });
});
