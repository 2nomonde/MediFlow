import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, cleanupTestData, setupTestUsers, TestUsers } from "./helpers";

describe("Audit log read restrictions", () => {
  let users: TestUsers;

  beforeAll(async () => {
    await cleanupTestData();
    users = await setupTestUsers();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("allows Admin to read audit logs", async () => {
    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${users.admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta?.pagination).toBeDefined();
  });

  it("rejects every non-admin role from reading audit logs", async () => {
    for (const user of [users.receptionist, users.nurse, users.doctor, users.pharmacist]) {
      const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${user.token}`);
      expect(res.status).toBe(403);
    }
  });

  it("rejects an unauthenticated request to audit logs", async () => {
    const res = await request(app).get("/api/audit-logs");
    expect(res.status).toBe(401);
  });
});

describe("Reports authorization & date validation", () => {
  let users: TestUsers;

  beforeAll(async () => {
    users = await setupTestUsers();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("allows Admin to fetch the report summary for a valid date range", async () => {
    const res = await request(app)
      .get("/api/reports/summary")
      .query({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
      .set("Authorization", `Bearer ${users.admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.queue).toBeDefined();
  });

  it("rejects every non-admin role from reports", async () => {
    for (const user of [users.receptionist, users.nurse, users.doctor, users.pharmacist]) {
      const res = await request(app)
        .get("/api/reports/summary")
        .query({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).toBe(403);
    }
  });

  it("rejects a malformed date rather than silently guessing", async () => {
    const res = await request(app)
      .get("/api/reports/summary")
      .query({ dateFrom: "not-a-date", dateTo: "2026-01-31" })
      .set("Authorization", `Bearer ${users.admin.token}`);
    expect(res.status).toBe(400);
  });

  it("rejects a nonsensical calendar date (e.g. Feb 30) rather than silently rolling it over", async () => {
    const res = await request(app)
      .get("/api/reports/summary")
      .query({ dateFrom: "2026-02-30", dateTo: "2026-03-01" })
      .set("Authorization", `Bearer ${users.admin.token}`);
    expect(res.status).toBe(400);
  });

  it("rejects dateFrom after dateTo", async () => {
    const res = await request(app)
      .get("/api/reports/summary")
      .query({ dateFrom: "2026-02-01", dateTo: "2026-01-01" })
      .set("Authorization", `Bearer ${users.admin.token}`);
    expect(res.status).toBe(400);
  });
});
