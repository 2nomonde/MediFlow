-- AlterEnum
-- Additive only: adds three new AuditAction values so appointment
-- creation, rescheduling, and cancellation can be recorded through the
-- existing AuditLog mechanism (Phase 15), exactly like every other
-- auditable action in this system. Nothing is removed, renamed, or
-- reordered, no existing AuditLog row is touched, and no table is
-- rewritten — PostgreSQL appends new values to the enum's label list.
-- Safe to run against the live database at any time; no downtime, no
-- data loss, fully backward compatible with every row written before it.
ALTER TYPE "AuditAction" ADD VALUE 'APPOINTMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'APPOINTMENT_RESCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE 'APPOINTMENT_CANCELLED';
