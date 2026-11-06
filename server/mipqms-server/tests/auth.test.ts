import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, cleanupTestData, setupTestUsers, TestUsers } from "./helpers";

describe("Authentication & RBAC", () => {
  let users: TestUsers;

  beforeAll(async () => {
    await cleanupTestData();
    users = await setupTestUsers();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("logs in successfully with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: users.admin.email, password: "TestPass123!" });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe("ADMIN");
  });

  it("rejects login with an incorrect password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: users.admin.email, password: "WrongPassword!" });
    expect(res.status).toBe(401);
  });

  it("rejects login for a nonexistent email", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@test.mipqms.local", password: "TestPass123!" });
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated request to a protected route", async () => {
    const res = await request(app).get("/api/queue");
    expect(res.status).toBe(401);
  });

  it("rejects a request with a malformed token", async () => {
    const res = await request(app).get("/api/queue").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("enforces RBAC: a role outside a route's allowed group gets 403, not 200", async () => {
    // Audit logs are ADMIN-only (Phase 15) — every other role must be refused.
    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${users.doctor.token}`);
    expect(res.status).toBe(403);
  });

  it("allows the correct role through the same route", async () => {
    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${users.admin.token}`);
    expect(res.status).toBe(200);
  });
});
