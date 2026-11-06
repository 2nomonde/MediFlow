import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, cleanupTestData, setupTestUsers, createTestPatient, getTestDepartment, TestUsers } from "./helpers";

describe("Triage requirement, consultation transitions, priority & override", () => {
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

  /**
   * Item 5 (post-review): every setup helper checks its response status
   * before reading response.body.data.* — a wrong route or an
   * unexpected auth/validation failure now fails loudly here, with the
   * real status and body, instead of surfacing later as an opaque
   * "Cannot read properties of undefined" deep inside a test.
   */
  async function checkIn(firstName: string) {
    const patient = await createTestPatient({ firstName, lastName: "Workflow" });
    const res = await request(app)
      .post("/api/queue/check-in")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({ patientId: patient.id, departmentId });
    if (res.status !== 201) {
      throw new Error(`Setup check-in failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.data as { id: string };
  }

  /**
   * Post-review correction: the real route is POST /api/triage (not
   * POST /api/triage/:queueEntryId), and createTriageSchema requires
   * queueEntryId in the body — confirmed directly against
   * triage.routes.ts / triage.validators.ts. The previous version of
   * this file called the wrong path everywhere triage was recorded, so
   * triage was silently never created, and every test that depended on
   * it (consultation start, priority calculation, override) was
   * exercising a different code path than intended.
   */
  async function recordTriage(queueEntryId: string, priorityLevel: string, extra: Record<string, unknown> = {}) {
    const res = await request(app)
      .post("/api/triage")
      .set("Authorization", `Bearer ${users.nurse.token}`)
      .send({ queueEntryId, priorityLevel, ...extra });
    if (res.status !== 201) {
      throw new Error(`Setup triage recording failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.data;
  }

  it("blocks starting a consultation before the patient has been CALLED", async () => {
    const entry = await checkIn("StartFromWaiting");
    const res = await request(app)
      .post(`/api/consultations/queue/${entry.id}/start`)
      .set("Authorization", `Bearer ${users.doctor.token}`);
    expect(res.status).toBe(409);
  });

  it("blocks starting a consultation for a non-emergency patient with no triage", async () => {
    const entry = await checkIn("NoTriage");
    await request(app)
      .patch(`/api/queue/${entry.id}/status`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ status: "CALLED" });

    const res = await request(app)
      .post(`/api/consultations/queue/${entry.id}/start`)
      .set("Authorization", `Bearer ${users.doctor.token}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/triaged/i);
  });

  it("allows starting a consultation once triage is recorded, and records consultationStartTime", async () => {
    const entry = await checkIn("Triaged");
    await recordTriage(entry.id, "NORMAL", { temperature: 36.6, heartRate: 72 });
    await request(app)
      .patch(`/api/queue/${entry.id}/status`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ status: "CALLED" });

    const start = await request(app)
      .post(`/api/consultations/queue/${entry.id}/start`)
      .set("Authorization", `Bearer ${users.doctor.token}`);
    expect(start.status).toBe(201);

    const updatedEntry = await prisma.queueEntry.findUnique({ where: { id: entry.id } });
    expect(updatedEntry?.status).toBe("IN_CONSULTATION");
    expect(updatedEntry?.consultationStartTime).toBeTruthy();
  });

  it("completes a started consultation and records consultationEndTime", async () => {
    const entry = await checkIn("CompleteFlow");
    await recordTriage(entry.id, "NORMAL");
    await request(app)
      .patch(`/api/queue/${entry.id}/status`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ status: "CALLED" });
    const start = await request(app)
      .post(`/api/consultations/queue/${entry.id}/start`)
      .set("Authorization", `Bearer ${users.doctor.token}`);
    if (start.status !== 201) {
      throw new Error(`Setup consultation start failed: ${start.status} ${JSON.stringify(start.body)}`);
    }

    const consultationId = start.body.data.id as string;
    const complete = await request(app)
      .post(`/api/consultations/${consultationId}/complete`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ diagnosis: "Fictional test diagnosis." });
    expect(complete.status).toBe(200);

    const updatedEntry = await prisma.queueEntry.findUnique({ where: { id: entry.id } });
    expect(updatedEntry?.status).toBe("COMPLETED");
    expect(updatedEntry?.consultationEndTime).toBeTruthy();
  });

  it("blocks completing a consultation that was never started", async () => {
    const res = await request(app)
      .post("/api/consultations/00000000-0000-0000-0000-000000000000/complete")
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it("emergency check-ins bypass the triage requirement", async () => {
    const patient = await createTestPatient({ firstName: "Emergency", lastName: "Bypass" });
    const checkin = await request(app)
      .post("/api/queue/check-in")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({ patientId: patient.id, departmentId, isEmergency: true });
    if (checkin.status !== 201) {
      throw new Error(`Setup check-in failed: ${checkin.status} ${JSON.stringify(checkin.body)}`);
    }
    const entryId = checkin.body.data.id as string;

    await request(app)
      .patch(`/api/queue/${entryId}/status`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ status: "CALLED" });

    const start = await request(app)
      .post(`/api/consultations/queue/${entryId}/start`)
      .set("Authorization", `Bearer ${users.doctor.token}`);
    expect(start.status).toBe(201);
  });

  it("calculates a higher priority score for EMERGENCY triage than NORMAL", async () => {
    const normalEntry = await checkIn("NormalPriority");
    await recordTriage(normalEntry.id, "NORMAL");

    const emergencyEntry = await checkIn("EmergencyPriority");
    await recordTriage(emergencyEntry.id, "EMERGENCY");

    const normalBreakdown = await request(app)
      .get(`/api/queue/${normalEntry.id}/priority`)
      .set("Authorization", `Bearer ${users.doctor.token}`);
    const emergencyBreakdown = await request(app)
      .get(`/api/queue/${emergencyEntry.id}/priority`)
      .set("Authorization", `Bearer ${users.doctor.token}`);

    expect(emergencyBreakdown.body.data.effectivePriority).toBeGreaterThan(normalBreakdown.body.data.effectivePriority);
  });

  it("applies a manual priority override and logs the reason, overriding user, and timestamp", async () => {
    const entry = await checkIn("OverrideTarget");
    await recordTriage(entry.id, "LOW");

    const override = await request(app)
      .post(`/api/queue/${entry.id}/priority/override`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ overrideValue: 999, reason: "Test override for automated coverage." });
    expect(override.status).toBe(200);

    const updated = await prisma.queueEntry.findUnique({ where: { id: entry.id } });
    expect(updated?.manualPriorityOverride).toBe(999);
    expect(updated?.manualPriorityReason).toBe("Test override for automated coverage.");
    expect(updated?.priorityOverriddenById).toBe(users.doctor.id);
    expect(updated?.priorityOverriddenAt).toBeTruthy();
  });

  it("rejects a priority override from a Receptionist (not in priorityOverride group)", async () => {
    const entry = await checkIn("OverrideBlocked");
    const res = await request(app)
      .post(`/api/queue/${entry.id}/priority/override`)
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({ overrideValue: 500, reason: "Should not be allowed." });
    expect(res.status).toBe(403);
  });
});
