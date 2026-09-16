import { describe, it, expect, vi } from "vitest";
import { HttpService } from "@shared/api/HttpService";

/** A stand-in axios instance that records how it was called. */
const fakeClient = (impl = async () => ({ data: { ok: true }, status: 200 })) => {
  const calls = [];
  const record = (method) => (...args) => {
    calls.push({ method, args });
    return impl(...args);
  };
  return {
    calls,
    get: record("get"),
    delete: record("delete"),
    post: record("post"),
    put: record("put"),
    patch: record("patch"),
  };
};

describe("HttpService", () => {
  it("returns just the data and status a caller reads", async () => {
    const client = fakeClient();
    const service = new HttpService(client);

    await expect(service.get("/thing")).resolves.toEqual({
      data: { ok: true },
      status: 200,
    });
  });

  it("never lets a config reach the body position", async () => {
    // The bug this class exists to make impossible: axios is get(url, config)
    // but post(url, data, config), and `api.post(url, config)` posted a
    // caller's headers — access token included — as the request payload.
    const client = fakeClient();
    const service = new HttpService(client);
    const config = { headers: { "X-Test": "1" } };

    await service.post("/send-otp", null, config);
    await service.get("/thing", config);

    const [post, get] = client.calls;
    expect(post.args).toEqual(["/send-otp", null, config]); // config third
    expect(get.args).toEqual(["/thing", config]); // config second
  });

  it("sends no body when a body-taking method is given none", async () => {
    const client = fakeClient();
    await new HttpService(client).post("/auth/send-otp");

    expect(client.calls[0].args).toEqual(["/auth/send-otp", null, undefined]);
  });

  it("rethrows a server error untouched", async () => {
    // Existing thunks catch this and read error.response.data. That path must
    // behave exactly as it did before the service layer existed.
    const failure = Object.assign(new Error("Request failed"), {
      response: { status: 422, data: { message: "Email already in use" } },
    });
    const service = new HttpService(fakeClient(async () => { throw failure; }));

    await expect(service.post("/auth/register", {})).rejects.toBe(failure);
  });

  it("gives a network failure a response so callers do not crash reading it", async () => {
    // A dropped connection produces an axios error with no `response`. Most
    // thunks here read `error.response.data` with no optional chaining, so the
    // catch block itself threw a TypeError, the thunk never settled with a
    // usable value, and the screen sat on its spinner with nothing to explain it.
    const service = new HttpService(fakeClient(async () => { throw new Error("Network Error"); }));

    await expect(service.get("/thing")).rejects.toMatchObject({
      response: { data: { message: expect.stringMatching(/couldn't reach the server/i) } },
    });
  });

  it("names a timeout as a timeout", async () => {
    const timeout = Object.assign(new Error("timeout"), { code: "ECONNABORTED" });
    const service = new HttpService(fakeClient(async () => { throw timeout; }));

    await expect(service.get("/slow")).rejects.toMatchObject({
      response: { data: { message: expect.stringMatching(/timed out/i) } },
    });
  });

  it("defaults to the shared client when none is given", async () => {
    // Constructed with no argument in production; the fake is a test affordance.
    expect(new HttpService().client).toBeDefined();
  });

  it("passes every verb through to the client", async () => {
    const client = fakeClient();
    const service = new HttpService(client);

    await service.get("/a");
    await service.delete("/b");
    await service.post("/c", { x: 1 });
    await service.put("/d", { x: 2 });
    await service.patch("/e", { x: 3 });

    expect(client.calls.map((call) => call.method)).toEqual([
      "get",
      "delete",
      "post",
      "put",
      "patch",
    ]);
  });
});
