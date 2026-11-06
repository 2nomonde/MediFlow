import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { QueueEntry } from "@/types/queue";

interface PriorityBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: QueueEntry | null;
}

function ContributionRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-navy-900">{value >= 0 ? "+" : ""}{value}</span>
    </div>
  );
}

/**
 * "Why this patient is ranked here" — a plain, fully transparent
 * breakdown of the formula's five terms plus any override. Every number
 * here comes directly from the backend's calculation; nothing is
 * summarized, hidden, or approximated for display.
 */
export function PriorityBreakdownModal({ isOpen, onClose, entry }: PriorityBreakdownModalProps) {
  if (!entry) return null;

  const b = entry.priorityBreakdown;
  // Defense in depth: the backend never sends priorityBreakdown to a
  // RECEPTIONIST, and QueuePage never lets a RECEPTIONIST open this
  // modal in the first place — but if it were ever opened without one,
  // show nothing rather than crashing on undefined fields.
  if (!b) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Why this patient is ranked here">
      <div className="space-y-4">
        <div>
          <p className="font-medium text-navy-900">
            {entry.patient.firstName} {entry.patient.lastName}
          </p>
          <p className="text-sm text-slate-500">
            {entry.patient.patientNumber} · {entry.queueNumber}
          </p>
        </div>

        <div className="rounded-md border border-slate-200 divide-y divide-slate-100 px-3">
          <ContributionRow label="Triage contribution" value={b.triageContribution} />
          <ContributionRow label="Emergency contribution" value={b.emergencyContribution} />
          <ContributionRow label="Waiting-time contribution" value={b.waitingTimeContribution} />
          <ContributionRow label="Appointment contribution" value={b.appointmentContribution} />
          <ContributionRow label="Vulnerability contribution" value={b.vulnerabilityContribution} />
          <div className="flex items-center justify-between py-2 text-sm font-semibold text-navy-900">
            <span>Total calculated score</span>
            <span>{b.calculatedScore}</span>
          </div>
        </div>

        {entry.hasManualOverride && (
          <div className="rounded-md border border-warning-100 bg-warning-50 px-3 py-2.5 text-sm">
            <div className="mb-1 flex items-center gap-2">
              <Badge tone="warning">Manual override active</Badge>
            </div>
            <p className="text-warning-700">
              Effective priority set to <strong>{entry.manualOverride}</strong> by{" "}
              {entry.overriddenBy ? `${entry.overriddenBy.firstName} ${entry.overriddenBy.lastName}` : "a staff member"}
              {entry.overriddenAt && ` on ${new Date(entry.overriddenAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}.
            </p>
            {entry.overrideReason && <p className="mt-1 text-warning-700">Reason: {entry.overrideReason}</p>}
          </div>
        )}

        <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-navy-900">
          <span>Effective priority</span>
          <span>{entry.effectivePriority}</span>
        </div>

        <p className="text-xs text-slate-400">
          This is an operational queue-ordering score, not a clinical or diagnostic assessment. Staff remain responsible
          for all clinical decisions.
        </p>
      </div>
    </Modal>
  );
}
