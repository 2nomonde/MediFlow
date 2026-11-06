import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, prisma, cleanupTestData, setupTestUsers, createTestPatient, getTestDepartment, getTestMedicine, TestUsers } from "./helpers";

describe("Prescription authorization & dispensing rules", () => {
  let users: TestUsers;
  let departmentId: string;
  let medicineId: string;

  beforeAll(async () => {
    await cleanupTestData();
    users = await setupTestUsers();
    departmentId = (await getTestDepartment()).id;
    medicineId = (await getTestMedicine()).id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  /**
   * Drives a fresh patient through check-in -> triage -> called ->
   * started consultation, returns the consultation id. Post-review
   * correction: triage is recorded via POST /api/triage with
   * queueEntryId in the body — not POST /api/triage/:queueEntryId,
   * which doesn't exist and was silently never recording triage,
   * causing the consultation `start` call below to fail the "must be
   * triaged" check it was meant to satisfy. Every setup step's status
   * is now checked before reading its response body (item 5).
   */
  async function startFreshConsultation(label: string, doctorToken: string) {
    const patient = await createTestPatient({ firstName: "Prescription", lastName: label });
    const checkin = await request(app)
      .post("/api/queue/check-in")
      .set("Authorization", `Bearer ${users.receptionist.token}`)
      .send({ patientId: patient.id, departmentId });
    if (checkin.status !== 201) {
      throw new Error(`Setup check-in failed: ${checkin.status} ${JSON.stringify(checkin.body)}`);
    }
    const entryId = checkin.body.data.id as string;

    const triage = await request(app)
      .post("/api/triage")
      .set("Authorization", `Bearer ${users.nurse.token}`)
      .send({ queueEntryId: entryId, priorityLevel: "NORMAL" });
    if (triage.status !== 201) {
      throw new Error(`Setup triage recording failed: ${triage.status} ${JSON.stringify(triage.body)}`);
    }

    const called = await request(app)
      .patch(`/api/queue/${entryId}/status`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ status: "CALLED" });
    if (called.status !== 200) {
      throw new Error(`Setup call-patient failed: ${called.status} ${JSON.stringify(called.body)}`);
    }

    const start = await request(app)
      .post(`/api/consultations/queue/${entryId}/start`)
      .set("Authorization", `Bearer ${doctorToken}`);
    if (start.status !== 201) {
      throw new Error(`Setup consultation start failed: ${start.status} ${JSON.stringify(start.body)}`);
    }
    return start.body.data.id as string;
  }

  const validPrescriptionBody = {
    medicineId: "",
    dosage: "500mg",
    frequency: "Twice daily",
    duration: "5 days",
    instructions: "Take with food.",
    quantity: 10,
  };

  it("allows the treating Doctor to create a prescription", async () => {
    const consultationId = await startFreshConsultation("DoctorCreate", users.doctor.token);
    const res = await request(app)
      .post(`/api/prescriptions/consultation/${consultationId}`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ ...validPrescriptionBody, medicineId });
    expect(res.status).toBe(201);
    expect(res.body.data.prescription.status).toBe("PENDING");
  });

  it("rejects prescription creation from Receptionist, Nurse, and Pharmacist", async () => {
    const consultationId = await startFreshConsultation("BlockedRoles", users.doctor.token);
    for (const user of [users.receptionist, users.nurse, users.pharmacist]) {
      const res = await request(app)
        .post(`/api/prescriptions/consultation/${consultationId}`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ ...validPrescriptionBody, medicineId });
      expect(res.status).toBe(403);
    }
  });

  it("rejects prescription creation from Admin (read-only, not clinical write)", async () => {
    const consultationId = await startFreshConsultation("AdminBlocked", users.doctor.token);
    const res = await request(app)
      .post(`/api/prescriptions/consultation/${consultationId}`)
      .set("Authorization", `Bearer ${users.admin.token}`)
      .send({ ...validPrescriptionBody, medicineId });
    expect(res.status).toBe(403);
  });

  it("rejects a doctor creating a prescription against another doctor's consultation", async () => {
    const consultationId = await startFreshConsultation("OwnershipCheck", users.doctor.token);
    const res = await request(app)
      .post(`/api/prescriptions/consultation/${consultationId}`)
      .set("Authorization", `Bearer ${users.doctorTwo.token}`)
      .send({ ...validPrescriptionBody, medicineId });
    expect(res.status).toBe(403);
  });

  it("rejects a nonpositive quantity", async () => {
    const consultationId = await startFreshConsultation("BadQuantity", users.doctor.token);
    const res = await request(app)
      .post(`/api/prescriptions/consultation/${consultationId}`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ ...validPrescriptionBody, medicineId, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it("allows a Pharmacist to dispense a pending prescription, recording who and when", async () => {
    const consultationId = await startFreshConsultation("DispenseFlow", users.doctor.token);
    const created = await request(app)
      .post(`/api/prescriptions/consultation/${consultationId}`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ ...validPrescriptionBody, medicineId });
    const prescriptionId = created.body.data.prescription.id as string;

    const dispense = await request(app)
      .post(`/api/prescriptions/${prescriptionId}/dispense`)
      .set("Authorization", `Bearer ${users.pharmacist.token}`);
    expect(dispense.status).toBe(200);
    expect(dispense.body.data.status).toBe("DISPENSED");
    expect(dispense.body.data.dispensedById).toBe(users.pharmacist.id);
    expect(dispense.body.data.dispensedAt).toBeTruthy();
  });

  it("rejects dispensing the same prescription twice", async () => {
    const consultationId = await startFreshConsultation("DoubleDispense", users.doctor.token);
    const created = await request(app)
      .post(`/api/prescriptions/consultation/${consultationId}`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ ...validPrescriptionBody, medicineId });
    const prescriptionId = created.body.data.prescription.id as string;

    const first = await request(app).post(`/api/prescriptions/${prescriptionId}/dispense`).set("Authorization", `Bearer ${users.pharmacist.token}`);
    expect(first.status).toBe(200);

    const second = await request(app).post(`/api/prescriptions/${prescriptionId}/dispense`).set("Authorization", `Bearer ${users.pharmacist.token}`);
    expect(second.status).toBe(409);
  });

  it("rejects dispensing from a Doctor (PHARMACIST only)", async () => {
    const consultationId = await startFreshConsultation("DoctorCannotDispense", users.doctor.token);
    const created = await request(app)
      .post(`/api/prescriptions/consultation/${consultationId}`)
      .set("Authorization", `Bearer ${users.doctor.token}`)
      .send({ ...validPrescriptionBody, medicineId });
    const prescriptionId = created.body.data.prescription.id as string;

    const res = await request(app).post(`/api/prescriptions/${prescriptionId}/dispense`).set("Authorization", `Bearer ${users.doctor.token}`);
    expect(res.status).toBe(403);
  });
});
