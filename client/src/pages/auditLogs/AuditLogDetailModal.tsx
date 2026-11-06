import { Modal } from "@/components/ui/Modal";
import { AuditActionBadge } from "@/components/common/AuditActionBadge";
import type { AuditLogEntry } from "@/types/auditLog";

interface AuditLogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: AuditLogEntry | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-navy-900">{value}</span>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <pre className="max-h-48 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/**
 * "What changed, where applicable" — every field shown here is already
 * exactly what the writing service chose to store (a few key
 * identifiers/values, per each service's own design — see the Phase 15
 * doc), never a raw dump of an entire record. AuditLog stays an
 * accountability trail, not a second clinical-record viewer.
 */
export function AuditLogDetailModal({ isOpen, onClose, entry }: AuditLogDetailModalProps) {
  if (!entry) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Audit log entry">
      <div className="space-y-4">
        <AuditActionBadge action={entry.action} />

        <div className="rounded-md border border-slate-200 px-3 divide-y divide-slate-100">
          <Row label="Performed by" value={`${entry.user.firstName} ${entry.user.lastName} (${entry.user.role})`} />
          <Row label="Entity" value={`${entry.entityType} · ${entry.entityId}`} />
          <Row
            label="Date & time"
            value={new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          />
          {entry.reason && <Row label="Reason" value={entry.reason} />}
        </div>

        {entry.description && <p className="text-sm text-slate-600">{entry.description}</p>}

        <JsonBlock label="Previous value" value={entry.previousValue} />
        <JsonBlock label="New value" value={entry.newValue} />

        {!entry.previousValue && !entry.newValue && (
          <p className="text-xs text-slate-400">No before/after values were recorded for this action.</p>
        )}
      </div>
    </Modal>
  );
}
