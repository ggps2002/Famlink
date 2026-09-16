/**
 * Deciding whether a MongoDB URI points at this machine.
 *
 * Kept apart from config/index.js because both the config and the Database
 * guard need it, and because it is the one piece of that decision worth testing
 * on its own — getting it wrong in either direction is expensive. Too strict and
 * a developer cannot connect to their own container; too loose and `npm run dev`
 * quietly reads and writes the production cluster.
 */

/** Hosts that can only mean "this machine". */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "host.docker.internal"]);

/**
 * The default a development machine uses when nothing else is configured.
 *
 * The database is named to match the deployed one — `famlink`, no "y", unlike
 * the repository folder — so a dump taken from a real environment restores here
 * without renaming anything.
 */
export const LOCAL_DB_URI = "mongodb://127.0.0.1:27017/famlink";

/**
 * The host:port list from a connection string, credentials stripped.
 *
 * Written by hand rather than with `new URL()` because a mongodb:// URI may
 * carry several comma-separated hosts for a replica set, which URL cannot
 * parse, and because a password containing "@" or "/" would otherwise shift
 * where the host appears to start.
 */
export const hostsOf = (uri = "") => {
  const withoutScheme = String(uri).replace(/^mongodb(\+srv)?:\/\//i, "");
  // Everything after the LAST "@" is the host list: a password may contain "@".
  const at = withoutScheme.lastIndexOf("@");
  const authority = at === -1 ? withoutScheme : withoutScheme.slice(at + 1);

  return authority
    .split(/[/?]/)[0]
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean)
    .map((host) => {
      // Strip the port, keeping bracketed IPv6 literals intact.
      if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1).toLowerCase();
      return host.split(":")[0].toLowerCase();
    });
};

/**
 * True when every host in the URI is this machine.
 *
 * `mongodb+srv://` is never local: the +srv form exists to look up a seed list
 * from DNS, which is how Atlas connection strings are written. Treating one as
 * local because its literal text has no hostname we recognise would defeat the
 * entire check.
 */
export const isLocalMongoUri = (uri = "") => {
  if (!uri) return false;
  if (/^mongodb\+srv:\/\//i.test(uri)) return false;

  const hosts = hostsOf(uri);
  return hosts.length > 0 && hosts.every((host) => LOOPBACK.has(host));
};

/**
 * A URI safe to print in a log line or an error: scheme, hosts and database
 * name only. Never the credentials.
 */
export const describeMongoUri = (uri = "") => {
  if (!uri) return "(unset)";
  const scheme = /^mongodb\+srv:/i.test(uri) ? "mongodb+srv" : "mongodb";
  const database = String(uri).split("/").pop().split("?")[0] || "";
  return `${scheme}://${hostsOf(uri).join(",")}${database ? `/${database}` : ""}`;
};
