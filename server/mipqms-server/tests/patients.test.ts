import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, cleanupTestData, setupTestUsers, TestUsers, TEST_PATIENT_ID_PREFIX, TEST_PHONE_PREFIX } from "./helpers";

describe("Patient duplicate prevention", () => {
  let users: TestUsers;

  beforeAll(async () => {
    await cleanupTestData();
    users = await setupTestUsers();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("registers a new fictional patient successfully", async () => {
    const res = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({
        firstName: "Duplicate",
        lastName: "TestCase",
        dateOfBirth: "1990-01-01",
        gender: "UNSPECIFIED",
        idOrPassportNumber: `${TEST_PATIENT_ID_PREFIX}DUP-001`,
      });
    expect(res.status).toBe(201);
  });

  it("rejects a second registration with the same idOrPassportNumber (strong duplicate match)", async () => {
    const res = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({
        firstName: "Different",
        lastName: "Name",
        dateOfBirth: "1985-05-05",
        gender: "MALE",
        idOrPassportNumber: `${TEST_PATIENT_ID_PREFIX}DUP-001`,
      });
    expect(res.status).toBe(409);
  });

  it("rejects a same name+DOB+matching-contact registration (fallback duplicate match — only applies when idOrPassportNumber is omitted)", async () => {
    const first = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({
        firstName: "Fallback",
        lastName: "Match",
        dateOfBirth: "1992-03-03",
        gender: "FEMALE",
        phone: `${TEST_PHONE_PREFIX}001`,
      });
    expect(first.status).toBe(201);

    const res = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({
        firstName: "Fallback",
        lastName: "Match",
        dateOfBirth: "1992-03-03",
        gender: "FEMALE",
        phone: `${TEST_PHONE_PREFIX}001`, // no idOrPassportNumber on either request — this is what triggers the fallback rule at all
      });
    expect(res.status).toBe(409);
  });

  it("does NOT block registration on name+DOB alone with no matching contact", async () => {
    await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({
        firstName: "Common",
        lastName: "Name",
        dateOfBirth: "1988-08-08",
        gender: "MALE",
        idOrPassportNumber: `${TEST_PATIENT_ID_PREFIX}DUP-004`,
        phone: "0821111111",
      });

    const res = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({
        firstName: "Common",
        lastName: "Name",
        dateOfBirth: "1988-08-08",
        gender: "MALE",
        idOrPassportNumber: `${TEST_PATIENT_ID_PREFIX}DUP-005`,
        phone: "0822222222", // different contact — name/DOB alone must never block
      });
    expect(res.status).toBe(201);
  });

  it("rejects patient registration from a Nurse (RECEPTIONIST/ADMIN only)", async () => {
    const res = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${users.nurse.token}`)
      .send({
        firstName: "Blocked",
        lastName: "Role",
        dateOfBirth: "1990-01-01",
        gender: "UNSPECIFIED",
        idOrPassportNumber: `${TEST_PATIENT_ID_PREFIX}DUP-006`,
      });
    expect(res.status).toBe(403);
  });
});
