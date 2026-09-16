import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import config from "../config/index.js";
import { database } from "./database/Database.js";

/**
 * Owns the running process: the HTTP listener, the Socket.IO server, the
 * database connection, and the background jobs.
 *
 * These were previously started as top-level statements in index.js, which
 * meant they all began the moment the file was imported and there was no order
 * between them — cron jobs were scheduled inside the `listen` callback, so a
 * job could fire against a database that had not finished connecting. Here
 * start() is a sequence with an explicit order, and stop() unwinds it.
 */
export class Server {
  #httpServer = null;
  #io = null;
  #jobs = [];

  /**
   * @param {object} options
   * @param {import("express").Express} options.app
   * @param {number} [options.port]
   * @param {Array<(io: SocketServer) => void>} [options.socketHandlers]
   * @param {Array<{ name: string, start: () => unknown, stop?: () => unknown }>} [options.jobs]
   */
  constructor({ app, port = config.port, socketHandlers = [], jobs = [] }) {
    this.app = app;
    this.port = port;
    this.socketHandlers = socketHandlers;
    this.jobDefinitions = jobs;
  }

  get io() {
    return this.#io;
  }

  get httpServer() {
    return this.#httpServer;
  }

  async start() {
    // Before anything can serve a request or run a job.
    await database.connect();

    this.#httpServer = createServer(this.app);
    this.#createSocketServer();

    await new Promise((resolve, reject) => {
      this.#httpServer.once("error", reject);
      this.#httpServer.listen(this.port, () => {
        this.#httpServer.removeListener("error", reject);
        resolve();
      });
    });

    console.log(`[server] listening on port ${this.port} (${config.env})`);

    this.#startJobs();
    this.#registerShutdownHandlers();

    return this;
  }

  #createSocketServer() {
    this.#io = new SocketServer(this.#httpServer, {
      cors: { origin: "*" },
      // The 1MB default silently disconnects the socket when a base64-encoded
      // voice message exceeds it, and the send is dropped with no error at
      // either end.
      maxHttpBufferSize: 10 * 1024 * 1024,
    });

    for (const attach of this.socketHandlers) attach(this.#io);
  }

  /**
   * Start the scheduled jobs.
   *
   * One failing to schedule must not stop the others or abort the boot: these
   * are independent digests, and a process that refuses to serve traffic
   * because a weekly email job could not be registered is strictly worse than
   * one that serves traffic without it.
   */
  #startJobs() {
    for (const job of this.jobDefinitions) {
      try {
        const handle = job.start();
        this.#jobs.push({ ...job, handle });
        console.log(`[jobs] started ${job.name}`);
      } catch (error) {
        console.error(`[jobs] failed to start ${job.name}:`, error);
      }
    }
  }

  async stop() {
    for (const job of this.#jobs) {
      try {
        // Awaited: the email dispatcher's stop() waits for the pass it is in to
        // finish, so its claimed messages are settled rather than left in
        // `sending` for another machine to reclaim two minutes later.
        await (job.stop?.() ?? job.handle?.stop?.());
      } catch (error) {
        console.error(`[jobs] failed to stop ${job.name}:`, error);
      }
    }
    this.#jobs = [];

    if (this.#io) await new Promise((resolve) => this.#io.close(resolve));
    if (this.#httpServer?.listening) {
      await new Promise((resolve) => this.#httpServer.close(resolve));
    }
    await database.disconnect();
  }

  /**
   * Close cleanly on the signals a platform actually sends.
   *
   * Fly sends SIGTERM and waits before killing the process; without a handler
   * every deploy severed in-flight requests and open sockets mid-frame.
   * The timer is a backstop for a close that hangs — an exit is guaranteed
   * either way, and `unref` keeps the timer itself from holding the loop open.
   */
  #registerShutdownHandlers() {
    let shuttingDown = false;

    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`[server] ${signal} received, shutting down`);

      const forceExit = setTimeout(() => {
        console.error("[server] graceful shutdown timed out, forcing exit");
        process.exit(1);
      }, 10000);
      forceExit.unref();

      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error("[server] error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }
}

export default Server;
