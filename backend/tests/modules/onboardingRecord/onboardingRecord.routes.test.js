import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// The real module, routes and service over an in-memory repository — so this
// exercises routing, validation and the reply shapes the forms depend on
// without a database.
const store = new Map();
vi.mock("#src/modules/onboardingRecord/onboardingRecord.repository.js", () => {
  const onboardingRecordRepository = {
    findByRecordId: async (recordId) => store.get(recordId) ?? null,
    mergeFields: async (recordId, fields, { email } = {}) => {
      const doc = store.get(recordId) ?? { recordId, fields: {}, createdAt: new Date("2026-09-25T09:00:00Z") };
      doc.fields = { ...doc.fields, ...fields };
      if (email) doc.email = email;
      store.set(recordId, doc);
      return doc;
    },
    listRecent: async () => [...store.values()],
  };
  return { onboardingRecordRepository, default: onboardingRecordRepository };
});

const { OnboardingRecordModule } = await import("#src/modules/onboardingRecord/onboardingRecord.module.js");
const { errorHandler } = await import("#src/core/http/middleware/errorHandler.js");

const app = express();
app.use(express.json());
const mod = new OnboardingRecordModule();
app.use(mod.basePath, mod.router);
app.use(errorHandler);

const ID = "0b9c6f3e-1a2b-4c3d-8e9f-a1b2c3d4e5f6";

beforeEach(() => store.clear());

describe("/onboarding-records", () => {
  it("creates, updates and reads back a record the way the forms use it", async () => {
    await request(app)
      .post("/onboarding-records")
      .send({ action: "create", Id: ID, Name: "Sam", Path: "Looking for nanny share position" })
      .expect(200, { status: "success", recordId: ID });

    await request(app)
      .post("/onboarding-records")
      .send({ action: "update", Id: ID, Email: "sam@example.com", Experience: "1-3 years" })
      .expect(200);

    const { body } = await request(app).get(`/onboarding-records/${ID}`).expect(200);
    expect(body.status).toBe("success");
    expect(body.record).toMatchObject({
      Id: ID,
      Name: "Sam",
      Path: "Looking for nanny share position",
      Email: "sam@example.com",
      Experience: "1-3 years",
    });
  });

  it("404s a record that doesn't exist", async () => {
    await request(app).get(`/onboarding-records/${ID}`).expect(404);
  });

  it("400s ids that aren't ours, on both routes", async () => {
    await request(app).post("/onboarding-records").send({ Id: "../etc", Name: "x" }).expect(400);
    await request(app).get("/onboarding-records/not-a-uuid").expect(400);
  });
});
