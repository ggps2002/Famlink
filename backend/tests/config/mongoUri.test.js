import { describe, it, expect } from "vitest";
import {
  hostsOf,
  isLocalMongoUri,
  describeMongoUri,
  LOCAL_DB_URI,
} from "#src/config/mongoUri.js";

/**
 * This decides whether `npm run dev` is allowed to open the connection, so it
 * is wrong in two directions and both are expensive: too strict and a developer
 * cannot reach their own container, too loose and local work runs against the
 * production cluster.
 */

describe("hostsOf", () => {
  it("reads the host from a plain URI", () => {
    expect(hostsOf("mongodb://127.0.0.1:27017/famylink")).toEqual(["127.0.0.1"]);
  });

  it("ignores credentials", () => {
    expect(hostsOf("mongodb://user:secret@localhost:27017/db")).toEqual(["localhost"]);
  });

  it("is not fooled by an @ inside the password", () => {
    // The naive split takes the FIRST "@", which would read "p@ss" as the host
    // and call an Atlas URI local.
    expect(hostsOf("mongodb://user:p@ss@cluster0.abc.mongodb.net/db")).toEqual([
      "cluster0.abc.mongodb.net",
    ]);
  });

  it("reads every host of a replica set", () => {
    expect(hostsOf("mongodb://a.example:27017,b.example:27017/db")).toEqual([
      "a.example",
      "b.example",
    ]);
  });

  it("keeps an IPv6 literal in one piece", () => {
    // Splitting on ":" would turn [::1] into "[".
    expect(hostsOf("mongodb://[::1]:27017/db")).toEqual(["[::1]"]);
  });

  it("stops at the database name and the query string", () => {
    expect(hostsOf("mongodb://localhost:27017/db?replicaSet=rs0")).toEqual(["localhost"]);
  });
});

describe("isLocalMongoUri", () => {
  it("accepts the loopback spellings", () => {
    for (const uri of [
      "mongodb://localhost:27017/famylink",
      "mongodb://127.0.0.1:27017/famylink",
      "mongodb://[::1]:27017/famylink",
      "mongodb://host.docker.internal:27017/famylink",
      LOCAL_DB_URI,
    ]) {
      expect(isLocalMongoUri(uri), uri).toBe(true);
    }
  });

  it("rejects a remote host", () => {
    expect(isLocalMongoUri("mongodb://db.internal.example:27017/famylink")).toBe(false);
  });

  it("rejects every +srv URI, whatever the host looks like", () => {
    // +srv means "resolve a seed list from DNS", which is how Atlas strings are
    // written. There is no local +srv deployment worth accommodating, and
    // reading one as local would defeat the whole check.
    expect(isLocalMongoUri("mongodb+srv://cluster0.abc.mongodb.net/famylink")).toBe(false);
    expect(isLocalMongoUri("mongodb+srv://localhost/famylink")).toBe(false);
  });

  it("rejects a replica set that is only partly local", () => {
    // One remote member is enough to reach the real cluster.
    expect(isLocalMongoUri("mongodb://localhost:27017,db.example:27017/famylink")).toBe(false);
  });

  it("rejects nothing at all", () => {
    expect(isLocalMongoUri("")).toBe(false);
    expect(isLocalMongoUri(undefined)).toBe(false);
  });

  it("is not confused by a hostname that merely contains 'localhost'", () => {
    expect(isLocalMongoUri("mongodb://localhost.evil.example:27017/db")).toBe(false);
  });
});

describe("describeMongoUri", () => {
  it("never includes the credentials", () => {
    const described = describeMongoUri("mongodb+srv://user:secret@cluster0.abc.mongodb.net/famylink");

    expect(described).not.toContain("secret");
    expect(described).not.toContain("user");
    expect(described).toBe("mongodb+srv://cluster0.abc.mongodb.net/famylink");
  });

  it("says so when there is no URI", () => {
    expect(describeMongoUri("")).toBe("(unset)");
  });
});
