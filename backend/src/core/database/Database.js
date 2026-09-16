import mongoose from "mongoose";
import config from "../../config/index.js";
import { describeMongoUri, isLocalMongoUri } from "../../config/mongoUri.js";

/**
 * Owns the Mongoose connection lifecycle.
 *
 * The previous DB/index.js called `mongoose.connect()` at module scope, which
 * made the connection a side effect of importing anything that touched a model.
 * That is fine for a process whose only job is to serve traffic, and wrong for
 * everything else: a unit test importing a service opened a socket to the
 * production cluster, and a CLI script could not choose its own database.
 * Connecting is now something a caller does on purpose.
 *
 * Models still register on Mongoose's default connection, so `mongoose.model()`
 * in a schema file keeps working exactly as before.
 */
export class Database {
  #connection = null;

  constructor({
    uri = config.db.uri,
    options = {},
    env = config.env,
    allowRemote = config.db.allowRemote,
  } = {}) {
    this.uri = uri;
    this.options = options;
    this.env = env;
    this.allowRemote = allowRemote;
  }

  /** True once the driver reports an open connection. */
  get isConnected() {
    return mongoose.connection.readyState === 1;
  }

  get connection() {
    return this.#connection ?? mongoose.connection;
  }

  /**
   * Open the connection, or return the existing one.
   *
   * Idempotent because both the HTTP server and the cron scheduler call it at
   * boot and neither should care which ran first.
   */
  async connect() {
    if (this.isConnected) return this.connection;

    if (!this.uri) {
      throw new Error(
        "Database.connect() called without a URI. Set MONGO_DB_URI, or pass one explicitly."
      );
    }

    this.#refuseRemoteOutsideProduction();
    this.#registerListeners();
    await mongoose.connect(this.uri, this.options);
    this.#connection = mongoose.connection;
    return this.#connection;
  }

  async disconnect() {
    if (mongoose.connection.readyState === 0) return;
    await mongoose.disconnect();
    this.#connection = null;
  }

  /**
   * The last gate before a socket opens.
   *
   * config/index.js already resolves a local URI for development, so in the
   * ordinary case this never fires. It exists for the paths that bypass that
   * resolution — `new Database({ uri })` in a script, a test fixture, a
   * one-off migration someone is writing at 2am — because those are exactly the
   * moments a connection to production does the most damage.
   *
   * Refusing is the right default here rather than warning. A warning scrolls
   * past; by the time it is read the writes have happened.
   */
  #refuseRemoteOutsideProduction() {
    if (this.env === "production" || this.allowRemote) return;
    if (isLocalMongoUri(this.uri)) return;

    throw new Error(
      `Refusing to connect to a non-local database in ${this.env}: ` +
        `${describeMongoUri(this.uri)}\n` +
        "  Start a local one with `npm run db:up`, or set MONGO_DB_URI_DEV to your own.\n" +
        "  If you really mean to use a remote database from here, set ALLOW_REMOTE_DB=true."
    );
  }

  /**
   * Connection-level logging, attached once.
   *
   * Mongoose buffers commands while disconnected and replays them on reconnect,
   * so a dropped connection produces no error at the call site — it produces a
   * request that hangs until the buffer times out. These are often the only
   * signal that happened.
   */
  #registerListeners() {
    const conn = mongoose.connection;
    if (conn.listenerCount("error") > 0) return;

    conn.on("error", (error) => console.error("[db] connection error:", error));
    conn.on("disconnected", () => console.warn("[db] disconnected"));
    conn.on("reconnected", () => console.log("[db] reconnected"));
    conn.once("open", () => console.log("[db] connected"));
  }
}

export const database = new Database();

export default database;
