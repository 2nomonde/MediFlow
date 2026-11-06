import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, cleanupTestData, setupTestUsers, createTestPatient, getTestDepartment, TestUsers } from "./helpers";

describe("Waiting-time estimate behavior", () => {
  let users: TestUsers;
  let departmentId: string;
  let outpatientsDepartmentId: string;

  beforeAll(async () => {
    await cleanupTestData();
    users = await setupTestUsers();
    departmentId = (await getTestDepartment()).id;
    outpatientsDepartmentId = (await getTestDepartment("Outpatients")).id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  /** Item 5 (post-review): checks the setup response's status before reading response.body.data.*. */
  async function checkInPatient(firstName: string, lastName: string, deptId: string) {
    const patient = await createTestPatient({ firstName, lastName });
    const res = await request(app)
      .post("/api/queue/check-in")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({ patientId: patient.id, departmentId: deptId });
    if (res.status !== 201) {
      throw new Error(`Setup check-in failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.data.id as string;
  }

  it("returns an exact zero-minute estimate for a patient who is next in line (0 patients ahead)", async () => {
    // Post-review correction: the seeded Phase 17 demo data intentionally
    // contains active General Practice queue entries — this test needs
    // a department with no existing active entry, so it uses Outpatients
    // instead. The class-level `departmentId` (General Practice) is
    // still used by the other two tests in this file, which don't
    // depend on being first in line.
    const entryId = await checkInPatient("Estimate", "NextInLine", outpatientsDepartmentId);

    const estimate = await request(app)
      .get(`/api/queue/${entryId}/estimate`)
      .set("Authorization", `Bearer ${users.receptionist.token}`);
    expect(estimate.status).toBe(200);
    expect(estimate.body.data.status).toBe("WAITING");
    expect(estimate.body.data.patientsAhead).toBe(0);
    expect(estimate.body.data.estimateAvailable).toBe(true);
    expect(estimate.body.data.estimatedWaitMinutes).toBe(0);
  });

  it("returns 'already called' state, not a numeric estimate, for a CALLED entry", async () => {
    const entryId = await checkInPatient("Estimate", "AlreadyCalled", departmentId);

    await request(app)
      .patch(`/api/queue/${entryId}/status`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ status: "CALLED" });

    const estimate = await request(app)
      .get(`/api/queue/${entryId}/estimate`)
      .set("Authorization", `Bearer ${users.receptionist.token}`);
    expect(estimate.status).toBe(200);
    expect(estimate.body.data.estimateAvailable).toBe(false);
    expect(estimate.body.data.estimatedWaitMinutes).toBeNull();
    expect(estimate.body.data.reason).toMatch(/already called/i);
  });

  it("estimate calls never change the queue entry's status (read-only)", async () => {
    const entryId = await checkInPatient("Estimate", "ReadOnly", departmentId);

    await request(app).get(`/api/queue/${entryId}/estimate`).set("Authorization", `Bearer ${users.receptionist.token}`);
    await request(app).get(`/api/queue/${entryId}/estimate`).set("Authorization", `Bearer ${users.receptionist.token}`);

    const entry = await prisma.queueEntry.findUnique({ where: { id: entryId } });
    expect(entry?.status).toBe("WAITING");
  });
});
