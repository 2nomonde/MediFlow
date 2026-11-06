-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN "manualPriorityOverride" DOUBLE PRECISION;
ALTER TABLE "QueueEntry" ADD COLUMN "manualPriorityReason" TEXT;
ALTER TABLE "QueueEntry" ADD COLUMN "priorityOverriddenById" TEXT;
ALTER TABLE "QueueEntry" ADD COLUMN "priorityOverriddenAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_priorityOverriddenById_fkey" FOREIGN KEY ("priorityOverriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
