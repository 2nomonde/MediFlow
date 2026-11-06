-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "manualPriorityOverride" DOUBLE PRECISION,
ADD COLUMN     "manualPriorityReason" TEXT,
ADD COLUMN     "priorityOverriddenAt" TIMESTAMP(3),
ADD COLUMN     "priorityOverriddenById" TEXT;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_priorityOverriddenById_fkey" FOREIGN KEY ("priorityOverriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
