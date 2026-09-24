import { describe, it, expect, vi } from "vitest";
import {
  OnboardingRecordService,
  mergeWithSheet,
} from "#src/modules/onboardingRecord/onboardingRecord.service.js";
import { NotFoundError, ValidationError } from "#src/core/errors/index.js";

const ID = "3f2b8c1e-6a4d-4f9b-9c7e-1d2a3b4c5d6e";

const build = (over = {}) => {
  const onboardingRecordRepository = {
    mergeFields: vi.fn().mockResolvedValue({}),
    findByRecordId: vi.fn().mockResolvedValue(null),
    listRecent: vi.fn().mockResolvedValue([]),
    ...over,
  };
  return { repo: onboardingRecordRepository, service: new OnboardingRecordService({ onboardingRecordRepository }) };
};

describe("OnboardingRecordService.save", () => {
  it("stores the form's columns under the record id, without the protocol words", async () => {
    const { repo, service } = build();

    await service.save({ action: "create", Id: ID, Name: "Sam", "Number of children": "2" });

    expect(repo.mergeFields).toHaveBeenCalledWith(
      ID,
      { Name: "Sam", "Number of children": "2" },
      { email: "" }
    );
  });

  it("treats an update for an unknown id as a create (merge + upsert)", async () => {
    const { repo, service } = build();
    await service.save({ action: "update", Id: ID, Email: " Sam@Example.com " });

    expect(repo.mergeFields).toHaveBeenCalledWith(ID, { Email: " Sam@Example.com " }, { email: "sam@example.com" });
  });

  it("refuses ids we did not issue", async () => {
    const { service } = build();
    await expect(service.save({ Id: "not-a-uuid", Name: "x" })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.save({ Name: "x" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("neutralises keys Mongo would read as operators or paths", async () => {
    const { repo, service } = build();
    await service.save({ Id: ID, $where: "x", "a.b": "y" });

    expect(repo.mergeFields.mock.calls[0][1]).toEqual({ where: "x", a_b: "y" });
  });

  it("stores objects as JSON text and caps runaway values", async () => {
    const { repo, service } = build();
    await service.save({ Id: ID, Location: { city: "Oakland" }, Notes: "x".repeat(30000) });

    const fields = repo.mergeFields.mock.calls[0][1];
    expect(fields.Location).toBe('{"city":"Oakland"}');
    expect(fields.Notes).toHaveLength(20000);
  });

  it("refuses a payload with too many columns", async () => {
    const { service } = build();
    const body = { Id: ID };
    for (let i = 0; i < 201; i++) body[`c${i}`] = "v";
    await expect(service.save(body)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("OnboardingRecordService.get", () => {
  it("returns the record as a sheet row", async () => {
    const createdAt = new Date("2026-09-25T10:00:00Z");
    const { service } = build({
      findByRecordId: vi.fn().mockResolvedValue({ recordId: ID, fields: { Name: "Sam", Path: "x" }, createdAt }),
    });

    await expect(service.get(ID)).resolves.toEqual({
      Timestamp: createdAt.toISOString(),
      Name: "Sam",
      Path: "x",
      Id: ID,
    });
  });

  it("404s an unknown record and 400s a malformed id", async () => {
    const { service } = build();
    await expect(service.get(ID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.get("nope")).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("admin sheet view", () => {
  it("builds headers from every record, Timestamp and Id first", async () => {
    const { service } = build({
      listRecent: vi.fn().mockResolvedValue([
        { recordId: "b", fields: { Timestamp: "t2", Email: "b@x.com" } },
        { recordId: "a", fields: { Timestamp: "t1", Name: "A" } },
      ]),
    });

    const sheet = await service.asSheet();
    expect(sheet.headers).toEqual(["Timestamp", "Id", "Email", "Name"]);
    expect(sheet.rows.map((r) => r.Id)).toEqual(["b", "a"]);
  });

  it("merges the old sheet's rows, preferring the database copy of an Id", () => {
    const db = { headers: ["Timestamp", "Id", "Name"], rows: [{ Id: "1", Name: "new" }], truncated: false, file: "Database" };
    const sheet = { headers: ["Id", "Name", "Legacy"], rows: [{ Id: "1", Name: "old" }, { Id: "2", Name: "only-sheet" }], file: "Forms" };

    const merged = mergeWithSheet(db, sheet);
    expect(merged.rows.map((r) => r.Name)).toEqual(["new", "only-sheet"]);
    expect(merged.headers).toEqual(["Timestamp", "Id", "Name", "Legacy"]);
    expect(merged.total).toBe(2);
  });
});
