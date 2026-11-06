import request from "supertest";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { PrismaClient, UserRole } from "@prisma/client";
import { createApp } from "../src/app";

/**
 * Everything this file creates is tagged so cleanup can find it without
 * ever touching real data or the demo/seed dataset from Phase 17's
 * seed.ts (which uses "DEMO-ID-*" for patients and "*@mipqms.local"
 * for users — deliberately different prefixes/domains from the ones
 * below, so the two can never collide or be mistaken for each other).
 */
export const TEST_EMAIL_DOMAIN = "@test.mipqms.local";
export const TEST_PATIENT_ID_PREFIX = "TEST-ID-";
export const TEST_PASSWORD = "TestPass123!";
/**
 * A small number of tests (the "fallback duplicate match" test, which
 * must send NO idOrPassportNumber to exercise the fallback rule at
 * all — see patient.service.ts's duplicate-detection rules) create a
 * patient with no idOrPassportNumber to key cleanup off. This
 * distinctive phone prefix — not used by any demo patient (Phase 17's
 * seed uses "082123400*") or realistic real number — is the fallback
 * marker cleanup uses to still find and remove those rows.
 */
export const TEST_PHONE_PREFIX = "0000000";

export const prisma = new PrismaClient();
export const app = createApp();

export interface TestUsers {
  admin: { id: string; email: string; token: string };
  receptionist: { id: string; email: string; token: string };
  nurse: { id: string; email: string; token: string };
  doctor: { id: string; email: string; token: string };
  doctorTwo: { id: string; email: string; token: string };
  pharmacist: { id: string; email: string; token: string };
}

async function ensureUser(email: string, role: UserRole, firstName: string, lastName: string): Promise<{ id: string; email: string }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { id: existing.id, email: existing.email };
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const created = await prisma.user.create({ data: { email, passwordHash, firstName, lastName, role } });
  return { id: created.id, email: created.email };
}

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Test login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  // Post-review correction: the real login response field is
  // `accessToken` (see auth.controller.ts / auth.service.ts) — not
  // `token`. The original guess here was wrong and produced an
  // `undefined` bearer token on every request, which is why nearly
  // every test failed with 401s once actually run against a real
  // server. Never change the API's own field name to suit a test.
  return res.body.data.accessToken as string;
}

/**
 * Idempotent: safe to call from multiple test files' `beforeAll` — each
 * call either finds the existing fixed-email test user or creates it,
 * then logs in fresh (tokens aren't persisted between runs). A second
 * doctor (`doctorTwo`) exists specifically for the "can't prescribe
 * against another doctor's consultation" ownership test.
 */
export async function setupTestUsers(): Promise<TestUsers> {
  const admin = await ensureUser(`test-admin${TEST_EMAIL_DOMAIN}`, UserRole.ADMIN, "Test", "Admin");
  const receptionist = await ensureUser(`test-receptionist${TEST_EMAIL_DOMAIN}`, UserRole.RECEPTIONIST, "Test", "Receptionist");
  const nurse = await ensureUser(`test-nurse${TEST_EMAIL_DOMAIN}`, UserRole.NURSE, "Test", "Nurse");
  const doctor = await ensureUser(`test-doctor${TEST_EMAIL_DOMAIN}`, UserRole.DOCTOR, "Test", "Doctor");
  const doctorTwo = await ensureUser(`test-doctor-two${TEST_EMAIL_DOMAIN}`, UserRole.DOCTOR, "Test", "DoctorTwo");
  const pharmacist = await ensureUser(`test-pharmacist${TEST_EMAIL_DOMAIN}`, UserRole.PHARMACIST, "Test", "Pharmacist");

  const [adminToken, receptionistToken, nurseToken, doctorToken, doctorTwoToken, pharmacistToken] = await Promise.all([
    login(admin.email),
    login(receptionist.email),
    login(nurse.email),
    login(doctor.email),
    login(doctorTwo.email),
    login(pharmacist.email),
  ]);

  return {
    admin: { ...admin, token: adminToken },
    receptionist: { ...receptionist, token: receptionistToken },
    nurse: { ...nurse, token: nurseToken },
    doctor: { ...doctor, token: doctorToken },
    doctorTwo: { ...doctorTwo, token: doctorTwoToken },
    pharmacist: { ...pharmacist, token: pharmacistToken },
  };
}

/** Returns (creating if necessary) the seeded "General Practice" department. Requires `npm run prisma:seed` to have been run at least once. */
export async function getTestDepartment(name = "General Practice") {
  const dept = await prisma.department.findUnique({ where: { name } });
  if (!dept) {
    throw new Error(`Department "${name}" not found — run "npm run prisma:seed" before running tests.`);
  }
  return dept;
}

export async function getTestMedicine(name = "Paracetamol") {
  const medicine = await prisma.medicine.findFirst({ where: { name } });
  if (!medicine) {
    throw new Error(`Medicine "${name}" not found — run "npm run prisma:seed" before running tests.`);
  }
  return medicine;
}

/**
 * Post-review correction: the previous `${Date.now()}-${counter}`
 * suffix was truncated by the trailing `.slice(0, 20)` on the full
 * patient number — `Date.now()` alone is 13 digits, so after the
 * fixed `MIP-<year>-T` prefix there wasn't enough room left before the
 * cut, and multiple patients created in quick succession (the normal
 * case across this test suite) could receive an identical, truncated
 * patientNumber. `crypto.randomUUID()` gives a genuinely
 * collision-resistant identifier instead of one derived from a
 * counter that a truncation could silently erase.
 */
function generateUniqueSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12); // 12 hex chars — negligible collision probability, no truncation of anything that matters
}

/** Creates a fresh, uniquely-identified fictional test patient. Never real patient data. */
export async function createTestPatient(overrides: Partial<{ firstName: string; lastName: string }> = {}) {
  const suffix = generateUniqueSuffix();
  return prisma.patient.create({
    data: {
      patientNumber: `MIP-T-${suffix}`, // 18 characters total, fixed length — well within any reasonable column size
      idOrPassportNumber: `${TEST_PATIENT_ID_PREFIX}${suffix}`,
      firstName: overrides.firstName ?? "Test",
      lastName: overrides.lastName ?? "Patient",
      dateOfBirth: new Date(1995, 0, 1),
      gender: "UNSPECIFIED",
    },
  });
}

/**
 * FK-safe cleanup, deepest dependents first: audit logs → prescriptions
 * → consultations → triage → queue entries → patients → users. Only
 * ever touches rows tagged with the TEST_* prefixes above — never a
 * demo/seed row, never anything without the test marker. Call from
 * both `beforeAll` (clean slate, in case a previous run crashed
 * mid-test) and `afterAll` (leave the database clean afterward).
 *
 * Post-review correction: AuditLog.userId is `ON DELETE RESTRICT`
 * (see the init migration) — deleting a test user who had authored an
 * AuditLog row (a priority override, a prescription create/dispense,
 * etc.) would fail with a foreign-key violation at the `user.deleteMany`
 * step below, since nothing was removing those rows first. Test user
 * IDs are captured here BEFORE any deletion, specifically so the
 * AuditLog cleanup below can be scoped by `userId` even after this
 * function's own later step deletes the users themselves — and
 * `queueEntryId` is included too, scoped to test patients' own queue
 * entries, in case an audit row was ever authored by a non-test actor
 * against a test queue entry. Both scopes are still strictly limited
 * to TEST_* -tagged data; a demo or real AuditLog row can never match
 * either condition.
 */
export async function cleanupTestData(): Promise<void> {
  const testPatients = await prisma.patient.findMany({
    where: {
      OR: [{ idOrPassportNumber: { startsWith: TEST_PATIENT_ID_PREFIX } }, { phone: { startsWith: TEST_PHONE_PREFIX } }],
    },
    select: { id: true },
  });
  const patientIds = testPatients.map((p: { id: string }) => p.id);

  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const userIds = testUsers.map((u: { id: string }) => u.id);

  let queueEntryIds: string[] = [];
  if (patientIds.length > 0) {
    const queueEntries = await prisma.queueEntry.findMany({ where: { patientId: { in: patientIds } }, select: { id: true } });
    queueEntryIds = queueEntries.map((q: { id: string }) => q.id);
  }

  // Audit rows first — the only remaining blocker for deleting test
  // users, now removed before anything downstream of it runs.
  if (userIds.length > 0 || queueEntryIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []), ...(queueEntryIds.length > 0 ? [{ queueEntryId: { in: queueEntryIds } }] : [])],
      },
    });
  }

  if (patientIds.length > 0) {
    const consultations = await prisma.consultation.findMany({ where: { patientId: { in: patientIds } }, select: { id: true } });
    const consultationIds = consultations.map((c: { id: string }) => c.id);

    if (consultationIds.length > 0) {
      await prisma.prescription.deleteMany({ where: { consultationId: { in: consultationIds } } });
      await prisma.consultation.deleteMany({ where: { id: { in: consultationIds } } });
    }
    await prisma.triage.deleteMany({ where: { queueEntry: { patientId: { in: patientIds } } } });
    await prisma.queueEntry.deleteMany({ where: { patientId: { in: patientIds } } });
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  }

  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
}
