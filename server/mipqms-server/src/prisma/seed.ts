import bcrypt from "bcrypt";
import { PrismaClient, UserRole, Gender, VulnerabilityCategory, QueueStatus, TriagePriority, PrescriptionStatus } from "@prisma/client";

/**
 * Because POST /api/auth/register is admin-only (Phase 4 requirement:
 * "User registration for authorized administrators"), there is no API
 * path that can create the very first administrator — an empty system
 * has no admin to authenticate as. This script creates exactly one
 * initial admin account directly in the database, bypassing the API
 * entirely, which is the standard way to solve this bootstrap problem
 * without weakening the "admin-only registration" rule with a special
 * case inside the auth service itself.
 *
 * Phase 9 addition: also seeds a small set of default Departments.
 * Phase 11 addition: seeds one default, active PriorityConfig.
 * Phase 14 addition: seeds fictional demo medicines.
 *
 * Phase 17 addition: seeds one demo user per role (Receptionist, Nurse,
 * Doctor, Pharmacist — Admin already existed) and a full demo
 * SCENARIO — several fictional patients moved through realistic queue
 * states (WAITING/CALLED/IN_CONSULTATION/COMPLETED/NO_SHOW/CANCELLED),
 * triage examples (normal and emergency-bypass), a manual priority
 * override, completed consultations with fictional clinical notes, and
 * prescriptions in both PENDING and DISPENSED states — specifically so
 * a lecturer demo or lecturer-run automated test suite has real,
 * varied, referenceable data to exercise every phase against without
 * anyone needing to click through the UI first.
 *
 * Deliberately NOT pre-populated here: AuditLog entries for the demo
 * scenario. Audit rows are meant to be a genuine record of real actions
 * (Phase 15) — fabricating them in a seed script would mean the audit
 * trail describes events that never actually happened through the
 * application. Performing the Doctor/Pharmacist demo workflows for
 * real (starting a consultation, overriding a priority, dispensing a
 * prescription) naturally populates AuditLog via the existing Phase
 * 11/14 write paths — see Phase17_Testing_Demo_Data.md.
 *
 * ALL data here is fictional. No real patient information is used or
 * should ever be added to this file.
 *
 * Run with: npm run prisma:seed
 * Safe to re-run — every section here is independently idempotent
 * (checked by a stable, recognizable key before writing) and none of
 * it ever deletes or resets existing data. See DEMO_PASSWORD below for
 * the shared demo login password used by every non-admin demo account.
 */

const prisma = new PrismaClient();

/** Obvious, documented, demo-only password — never used for the admin account, which keeps its own separate seed password (see seedAdmin). */
const DEMO_PASSWORD = "Demo1234!";

const DEFAULT_DEPARTMENTS = [
  { name: "General Practice", description: "General outpatient consultations." },
  { name: "Emergency", description: "Urgent and emergency cases." },
  { name: "Outpatients", description: "Scheduled and walk-in outpatient services." },
];

// Phase 14 addition: fictional demo medicines only, per the Phase 14
// testing instruction ("use fictional/demo patient and medicine data
// only"). Nothing before Phase 14 exposed or populated Medicine at all
// — without this, the prescription module would be untestable end-to-
// end, the same gap Phase 9 solved for Department.
const DEFAULT_MEDICINES = [
  { name: "Amoxicillin", genericName: "Amoxicillin", category: "Antibiotic", dosageForm: "Capsule", strength: "500mg", stockQuantity: 200 },
  { name: "Paracetamol", genericName: "Paracetamol", category: "Analgesic", dosageForm: "Tablet", strength: "500mg", stockQuantity: 500 },
  { name: "Ibuprofen", genericName: "Ibuprofen", category: "NSAID", dosageForm: "Tablet", strength: "400mg", stockQuantity: 300 },
  { name: "Metformin", genericName: "Metformin", category: "Antidiabetic", dosageForm: "Tablet", strength: "500mg", stockQuantity: 150 },
  { name: "Amlodipine", genericName: "Amlodipine", category: "Antihypertensive", dosageForm: "Tablet", strength: "5mg", stockQuantity: 120 },
];

/** Phase 17: one demo account per non-admin role, fixed emails so re-runs are idempotent. */
const DEMO_STAFF: Array<{ email: string; firstName: string; lastName: string; role: UserRole }> = [
  { email: "reception@mipqms.local", firstName: "Nomvula", lastName: "Khumalo", role: UserRole.RECEPTIONIST },
  { email: "nurse@mipqms.local", firstName: "Thandeka", lastName: "Ngcobo", role: UserRole.NURSE },
  { email: "doctor@mipqms.local", firstName: "Sipho", lastName: "Dlamini", role: UserRole.DOCTOR },
  { email: "pharmacist@mipqms.local", firstName: "Ayanda", lastName: "Zulu", role: UserRole.PHARMACIST },
];

/** Phase 17: fictional demo patients. idOrPassportNumber is the idempotency key (unique on the schema). */
const DEMO_PATIENTS = [
  {
    idOrPassportNumber: "DEMO-ID-0001",
    firstName: "Zanele",
    lastName: "Mokoena",
    dateOfBirth: new Date(1990, 4, 12),
    gender: Gender.FEMALE,
    phone: "0821234001",
    vulnerabilityCategory: VulnerabilityCategory.NONE,
    allergies: "None known",
  },
  {
    idOrPassportNumber: "DEMO-ID-0002",
    firstName: "Bongani",
    lastName: "Nkosi",
    dateOfBirth: new Date(1957, 10, 3),
    gender: Gender.MALE,
    phone: "0821234002",
    vulnerabilityCategory: VulnerabilityCategory.ELDERLY,
    chronicConditions: "Hypertension",
  },
  {
    idOrPassportNumber: "DEMO-ID-0003",
    firstName: "Lindiwe",
    lastName: "Mahlangu",
    dateOfBirth: new Date(1996, 1, 20),
    gender: Gender.FEMALE,
    phone: "0821234003",
    vulnerabilityCategory: VulnerabilityCategory.PREGNANT,
  },
  {
    idOrPassportNumber: "DEMO-ID-0004",
    firstName: "Mandla",
    lastName: "Sithole",
    dateOfBirth: new Date(1982, 7, 8),
    gender: Gender.MALE,
    phone: "0821234004",
    vulnerabilityCategory: VulnerabilityCategory.NONE,
  },
  {
    idOrPassportNumber: "DEMO-ID-0005",
    firstName: "Precious",
    lastName: "Dube",
    dateOfBirth: new Date(2001, 2, 15),
    gender: Gender.FEMALE,
    phone: "0821234005",
    vulnerabilityCategory: VulnerabilityCategory.NONE,
  },
  {
    idOrPassportNumber: "DEMO-ID-0006",
    firstName: "Thabo",
    lastName: "Radebe",
    dateOfBirth: new Date(1975, 5, 25),
    gender: Gender.MALE,
    phone: "0821234006",
    vulnerabilityCategory: VulnerabilityCategory.CHRONIC_CONDITION,
    chronicConditions: "Type 2 diabetes",
  },
];

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function seedAdmin(): Promise<void> {
  const existingAdmin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });

  if (existingAdmin) {
    console.log(`ℹ️  An administrator already exists (${existingAdmin.email}). Admin seed skipped.`);
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@mipqms.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "System",
      lastName: "Administrator",
      role: UserRole.ADMIN,
    },
  });

  console.log("✅ Initial administrator account created:");
  console.log(`   Email:    ${admin.email}`);
  console.log(`   Password: ${password}`);
  console.log("⚠️  Log in and create a real admin account, then deactivate or change this one — these are placeholder credentials, not secure for real use.");
}

async function seedDepartments(): Promise<void> {
  const existingCount = await prisma.department.count();
  if (existingCount > 0) {
    console.log(`ℹ️  ${existingCount} department(s) already exist. Department seed skipped.`);
    return;
  }

  for (const department of DEFAULT_DEPARTMENTS) {
    await prisma.department.create({ data: department });
  }
  console.log(`✅ Seeded ${DEFAULT_DEPARTMENTS.length} default departments: ${DEFAULT_DEPARTMENTS.map((d) => d.name).join(", ")}.`);
}

async function seedPriorityConfig(): Promise<void> {
  const existingActive = await prisma.priorityConfig.findFirst({ where: { isActive: true } });
  if (existingActive) {
    console.log(`ℹ️  An active priority configuration already exists (${existingActive.name}). Priority config seed skipped.`);
    return;
  }

  const config = await prisma.priorityConfig.create({
    data: {
      name: "default",
      isActive: true,
      // Matches PriorityConfig's own schema @default values exactly.
      triageWeight: 10,
      emergencyBonus: 1000,
      waitingTimeWeightPerMinute: 1,
      appointmentOnTimeBonus: 20,
      vulnerabilityBonus: 15,
    },
  });
  console.log(`✅ Seeded default active priority configuration "${config.name}".`);
}

async function seedMedicines(): Promise<void> {
  const existingCount = await prisma.medicine.count();
  if (existingCount > 0) {
    console.log(`ℹ️  ${existingCount} medicine(s) already exist. Medicine seed skipped.`);
    return;
  }

  for (const medicine of DEFAULT_MEDICINES) {
    await prisma.medicine.create({ data: medicine });
  }
  console.log(`✅ Seeded ${DEFAULT_MEDICINES.length} default medicines: ${DEFAULT_MEDICINES.map((m) => m.name).join(", ")}.`);
}

/**
 * Phase 17: one demo user per non-admin role. Idempotent per fixed
 * email, same pattern as seedAdmin — with one deliberate difference:
 * if the account already exists (e.g. from an earlier phase or a
 * prior seed run), its password is ALWAYS reset to the current
 * DEMO_PASSWORD rather than left alone. Post-review correction: the
 * original "skip if exists" behavior meant the documented demo
 * password could silently stop matching reality for an account that
 * predated this seed section — the whole point of documenting a fixed
 * demo password is that it actually works after running the seed
 * script. This never touches role, name, or any other field on an
 * existing account, and — because it's keyed to these four specific,
 * fixed demo emails only — never affects any other user in the system.
 */
async function seedDemoStaff(): Promise<Record<UserRole, string>> {
  const ids: Partial<Record<UserRole, string>> = {};
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const staff of DEMO_STAFF) {
    const existing = await prisma.user.findUnique({ where: { email: staff.email } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
      ids[staff.role] = existing.id;
      console.log(`ℹ️  Demo ${staff.role.toLowerCase()} account already existed (${staff.email}) — password reset to the documented demo password.`);
      continue;
    }
    const created = await prisma.user.create({
      data: { email: staff.email, passwordHash, firstName: staff.firstName, lastName: staff.lastName, role: staff.role },
    });
    ids[staff.role] = created.id;
    console.log(`✅ Seeded demo ${staff.role.toLowerCase()} account: ${staff.email}`);
  }

  const admin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
  if (admin) ids[UserRole.ADMIN] = admin.id;

  return ids as Record<UserRole, string>;
}

/** Phase 17: fictional demo patients. Idempotent per idOrPassportNumber (unique on the schema). */
async function seedDemoPatients(): Promise<string[]> {
  const ids: string[] = [];
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < DEMO_PATIENTS.length; i++) {
    const patientData = DEMO_PATIENTS[i];
    const existing = await prisma.patient.findUnique({ where: { idOrPassportNumber: patientData.idOrPassportNumber } });
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    // Matches the real patient.service.ts numbering convention
    // (MIP-<year>-<6-digit>) but in a distinct 9000xx block so these
    // demo numbers can never collide with a real, service-generated
    // sequence number.
    const patientNumber = `MIP-${currentYear}-9000${String(i + 1).padStart(2, "0")}`;
    const created = await prisma.patient.create({
      data: { ...patientData, patientNumber, registrationDate: minutesAgo(60 * 24 * (i + 1)) },
    });
    ids.push(created.id);
  }
  console.log(`✅ Demo patients ready (${ids.length}).`);
  return ids;
}

/**
 * Phase 17: the full demo scenario — queue entries in every realistic
 * status, triage (normal + emergency-bypass), a manual priority
 * override, completed consultations with fictional clinical notes, and
 * prescriptions in both PENDING and DISPENSED states.
 *
 * Idempotency: coarse-grained, matching this file's existing style —
 * if ANY queue entry already exists for the first demo patient, the
 * entire scenario is assumed already seeded and is skipped outright,
 * rather than trying to reconcile a partially-modified demo state.
 */
async function seedDemoScenario(
  staffIds: Record<UserRole, string>,
  patientIds: string[]
): Promise<void> {
  const alreadySeeded = await prisma.queueEntry.findFirst({ where: { patientId: patientIds[0] } });
  if (alreadySeeded) {
    console.log("ℹ️  Demo queue/triage/consultation/prescription scenario already exists. Scenario seed skipped.");
    return;
  }

  const departments = await prisma.department.findMany();
  const generalPractice = departments.find((d: { name: string }) => d.name === "General Practice")!;
  const emergency = departments.find((d: { name: string }) => d.name === "Emergency")!;
  const outpatients = departments.find((d: { name: string }) => d.name === "Outpatients")!;
  const medicines = await prisma.medicine.findMany();
  const paracetamol = medicines.find((m: { name: string }) => m.name === "Paracetamol")!;
  const amoxicillin = medicines.find((m: { name: string }) => m.name === "Amoxicillin")!;

  const [patientWaiting, patientCalled, patientEmergency, patientCompleted, patientNoShow, patientCancelled] = patientIds;

  // 1. WAITING — checked in recently, triaged NORMAL, General Practice.
  const waitingEntry = await prisma.queueEntry.create({
    data: { patientId: patientWaiting, departmentId: generalPractice.id, status: QueueStatus.WAITING, checkInTime: minutesAgo(15) },
  });
  await prisma.triage.create({
    data: {
      queueEntryId: waitingEntry.id,
      recordedById: staffIds[UserRole.NURSE],
      temperature: 36.8,
      bloodPressureSys: 118,
      bloodPressureDia: 76,
      heartRate: 78,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      painScore: 1,
      symptoms: "Mild headache, requesting check-up.",
      priorityLevel: TriagePriority.NORMAL,
    },
  });

  // 2. CALLED — triaged HIGH, then given a manual priority override by
  // the doctor with a documented reason (Phase 11 override fields).
  const calledEntry = await prisma.queueEntry.create({
    data: { patientId: patientCalled, departmentId: generalPractice.id, status: QueueStatus.CALLED, checkInTime: minutesAgo(40), calledTime: minutesAgo(5) },
  });
  await prisma.triage.create({
    data: {
      queueEntryId: calledEntry.id,
      recordedById: staffIds[UserRole.NURSE],
      temperature: 38.4,
      bloodPressureSys: 152,
      bloodPressureDia: 94,
      heartRate: 102,
      respiratoryRate: 20,
      oxygenSaturation: 95,
      painScore: 6,
      symptoms: "Chest tightness and elevated blood pressure.",
      priorityLevel: TriagePriority.HIGH,
    },
  });
  await prisma.queueEntry.update({
    where: { id: calledEntry.id },
    data: {
      manualPriorityOverride: 850,
      manualPriorityReason: "Elevated BP with chest tightness — brought forward pending doctor review.",
      priorityOverriddenById: staffIds[UserRole.DOCTOR],
      priorityOverriddenAt: minutesAgo(4),
    },
  });

  // 3. IN_CONSULTATION — Emergency department, isEmergency bypass (no
  // triage required), consultation already started.
  const emergencyEntry = await prisma.queueEntry.create({
    data: {
      patientId: patientEmergency,
      departmentId: emergency.id,
      status: QueueStatus.IN_CONSULTATION,
      isEmergency: true,
      checkInTime: minutesAgo(25),
      calledTime: minutesAgo(20),
      consultationStartTime: minutesAgo(18),
    },
  });
  await prisma.consultation.create({
    data: {
      queueEntryId: emergencyEntry.id,
      patientId: patientEmergency,
      doctorId: staffIds[UserRole.DOCTOR],
      departmentId: emergency.id,
      chiefComplaint: "Sudden onset abdominal pain.",
      startedAt: minutesAgo(18),
    },
  });

  // 4. COMPLETED — full journey: triaged, consultation completed with
  // fictional clinical notes, one dispensed and one pending prescription.
  const completedEntry = await prisma.queueEntry.create({
    data: {
      patientId: patientCompleted,
      departmentId: generalPractice.id,
      status: QueueStatus.COMPLETED,
      checkInTime: minutesAgo(90),
      calledTime: minutesAgo(70),
      consultationStartTime: minutesAgo(65),
      consultationEndTime: minutesAgo(45),
    },
  });
  await prisma.triage.create({
    data: {
      queueEntryId: completedEntry.id,
      recordedById: staffIds[UserRole.NURSE],
      temperature: 37.9,
      bloodPressureSys: 124,
      bloodPressureDia: 80,
      heartRate: 88,
      respiratoryRate: 18,
      oxygenSaturation: 97,
      painScore: 3,
      symptoms: "Sore throat and mild fever for two days.",
      priorityLevel: TriagePriority.NORMAL,
    },
  });
  const completedConsultation = await prisma.consultation.create({
    data: {
      queueEntryId: completedEntry.id,
      patientId: patientCompleted,
      doctorId: staffIds[UserRole.DOCTOR],
      departmentId: generalPractice.id,
      chiefComplaint: "Sore throat and fever for two days.",
      clinicalNotes: "Mild pharyngeal erythema, no exudate. Afebrile at time of exam.",
      assessment: "Likely viral pharyngitis.",
      diagnosis: "Acute pharyngitis (viral).",
      treatmentPlan: "Supportive care, fluids, review if symptoms persist beyond 5 days.",
      startedAt: minutesAgo(65),
      completedAt: minutesAgo(45),
    },
  });
  await prisma.prescription.create({
    data: {
      consultationId: completedConsultation.id,
      medicineId: paracetamol.id,
      dosage: "500mg",
      frequency: "Every 6 hours as needed",
      duration: "5 days",
      route: "Oral",
      instructions: "Take with food. Do not exceed 4 doses in 24 hours.",
      quantity: 20,
      status: PrescriptionStatus.DISPENSED,
      dispensedById: staffIds[UserRole.PHARMACIST],
      dispensedAt: minutesAgo(40),
    },
  });
  await prisma.prescription.create({
    data: {
      consultationId: completedConsultation.id,
      medicineId: amoxicillin.id,
      dosage: "500mg",
      frequency: "Three times daily",
      duration: "7 days",
      route: "Oral",
      instructions: "Complete the full course even if symptoms improve.",
      quantity: 21,
      status: PrescriptionStatus.PENDING,
    },
  });

  // 5. NO_SHOW — Outpatients.
  await prisma.queueEntry.create({
    data: { patientId: patientNoShow, departmentId: outpatients.id, status: QueueStatus.NO_SHOW, checkInTime: minutesAgo(120), calledTime: minutesAgo(100) },
  });

  // 6. CANCELLED — Outpatients.
  await prisma.queueEntry.create({
    data: { patientId: patientCancelled, departmentId: outpatients.id, status: QueueStatus.CANCELLED, checkInTime: minutesAgo(200) },
  });

  console.log("✅ Seeded demo scenario: 6 queue entries (WAITING, CALLED + override, IN_CONSULTATION, COMPLETED, NO_SHOW, CANCELLED), 3 triage records, 2 consultations, 2 prescriptions (1 dispensed, 1 pending).");
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedDepartments();
  await seedPriorityConfig();
  await seedMedicines();
  const staffIds = await seedDemoStaff();
  const patientIds = await seedDemoPatients();
  await seedDemoScenario(staffIds, patientIds);

  console.log("");
  console.log("─".repeat(60));
  console.log(`Demo accounts (password for all non-admin roles: ${DEMO_PASSWORD})`);
  for (const staff of DEMO_STAFF) console.log(`  ${staff.role.padEnd(13)} ${staff.email}`);
  console.log("─".repeat(60));
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
