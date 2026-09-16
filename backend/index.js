/**
 * Process entry point.
 *
 * Everything this file used to do — build the Express app, open the database,
 * create the Socket.IO server, schedule seven cron jobs — now lives in
 * src/bootstrap.js behind objects that can be constructed without any of it
 * happening. All this file decides is that *this* process is a server.
 *
 * That separation is what makes the app testable: importing the application no
 * longer binds a port or connects to a cluster.
 */
import { startServer } from "./src/bootstrap.js";

startServer().catch((error) => {
  console.error("[server] failed to start:", error);
  process.exit(1);
});
