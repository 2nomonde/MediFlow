import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, cleanupTestData, setupTestUsers, createTestPatient, getTestDepartment, TestUsers } from "./helpers";

describe("Queue check-in rules", () => {
  let users: TestUsers;
  let departmentId: string;

  beforeAll(async () => {
    await cleanupTestData();
    users = await setupTestUsers();
    departmentId = (await getTestDepartment()).id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("checks a patient in successfully", async () => {
    const patient = await createTestPatient({ firstName: "CheckIn", lastName: "Success" });
    const res = await request(app)
      .post("/api/queue/check-in")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({ patientId: patient.id, departmentId });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("WAITING");
  });

  it("rejects a second active check-in for the same patient (one active entry per patient)", async () => {
    const patient = await createTestPatient({ firstName: "CheckIn", lastName: "Duplicate" });
    const first = await request(app)
      .post("/api/queue/check-in")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({ patientId: patient.id, departmentId });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/queue/check-in")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({ patientId: patient.id, departmentId });
    expect(second.status).toBe(409);
  });

  it("rejects check-in for a nonexistent patient", async () => {
    const res = await request(app)
      .post("/api/queue/check-in")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({ patientId: "00000000-0000-0000-0000-000000000000", departmentId });
    expect(res.status).toBe(404);
  });

  it("rejects check-in from a Doctor (RECEPTIONIST/ADMIN only)", async () => {
    const patient = await createTestPatient({ firstName: "CheckIn", lastName: "WrongRole" });
    const res = await request(app)
      .post("/api/queue/check-in")
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ patientId: patient.id, departmentId });
    expect(res.status).toBe(403);
  });
});
