import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { priorityService } from "@/services/priority.service";
import { getErrorMessage } from "@/services/api";
import type { QueueEntry } from "@/types/queue";

interface OverridePriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: QueueEntry | null;
  onOverridden: () => void;
}

/**
 * Only rendered/opened for NURSE/DOCTOR/ADMIN (see QueuePage) — the
 * backend independently enforces this too (403 for RECEPTIONIST/
 * PHARMACIST), so this UI gate is convenience, not the security
 * boundary.
 */
export function OverridePriorityModal({ isOpen, onClose, entry, onOverridden }: OverridePriorityModalProps) {
  const [overrideValue, setOverrideValue] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && entry) {
      setOverrideValue(String(entry.effectivePriority));
      setReason("");
      setError(null);
    }
  }, [isOpen, entry]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!entry) return;
    const numericValue = Number(overrideValue);
    if (Number.isNaN(numericValue) || numericValue < 0) {
      setError("Enter a valid, non-negative priority value.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Provide a documented reason of at least 10 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await priorityService.override(entry.id, { overrideValue: numericValue, reason: reason.trim() });
      onOverridden();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!entry) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Override priority">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <p className="font-medium text-navy-900">
            {entry.patient.firstName} {entry.patient.lastName}
          </p>
          <p className="text-slate-500">
            {entry.queueNumber} · Calculated score: {entry.priorityBreakdown?.calculatedScore ?? entry.priorityScore}
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-warning-100 bg-warning-50 px-3 py-2.5 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Manual priority overrides affect queue ordering and must have a documented reason.</p>
        </div>

        <Input
          label="New effective priority"
          type="number"
          min={0}
          step="0.1"
          required
          value={overrideValue}
          onChange={(e) => setOverrideValue(e.target.value)}
          disabled={isSubmitting}
        />

        <Input
          label="Reason"
          required
          hint="At least 10 characters — explain the clinical or operational reason for this override."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isSubmitting}
        />

        {error && (
          <p role="alert" className="text-sm text-danger-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Save override
          </Button>
        </div>
      </form>
    </Modal>
  );
}
