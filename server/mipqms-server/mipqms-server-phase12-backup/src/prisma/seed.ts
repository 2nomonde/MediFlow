import bcrypt from "bcrypt";
import { PrismaClient, UserRole } from "@prisma/client";

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
 * QueueEntry.departmentId is required, but no Department-management
 * module exists yet (that's a future Administration phase) and no
 * department data existed anywhere in the project before Phase 9 — an
 * empty system had no department to check a patient into, which would
 * make the entire queue module untestable. This is data, not a schema
 * change, and is the minimal addition needed to make check-in usable.
 *
 * Phase 11 addition: seeds one default, active PriorityConfig. The
 * Phase 11 brief requires "there must be one active PriorityConfig,"
 * and nothing before this phase created one. Uses the same default
 * values as the schema's own `@default`s on PriorityConfig, so the
 * seeded row and an un-persisted fallback (see
 * priorityConfig.service.ts) always agree.
 *
 * Run with: npm run prisma:seed
 * Safe to re-run — admin, department, and priority-config seeding are
 * each independently idempotent, and none of them ever deletes or
 * resets existing data.
 */

const prisma = new PrismaClient();

const DEFAULT_DEPARTMENTS = [
  { name: "General Practice", description: "General outpatient consultations." },
  { name: "Emergency", description: "Urgent and emergency cases." },
  { name: "Outpatients", description: "Scheduled and walk-in outpatient services." },
];

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

async function main(): Promise<void> {
  await seedAdmin();
  await seedDepartments();
  await seedPriorityConfig();
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

