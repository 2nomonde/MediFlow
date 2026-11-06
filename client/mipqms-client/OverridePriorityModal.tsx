import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { priorityService } from "@/services/priority.service";
import { getErrorMessage } from "@/services/api";
import type { QueueEntry } from "@/types/queue";

interface OverridePriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: QueueEntry | null;
  /** Called with the updated effective priority once the override succeeds, so the caller can refresh the list. */
  onOverridden: () => void;
}

const MIN_REASON_LENGTH = 10;

/**
 * A controlled, documented override of a patient's calculated priority.
 * The backend requires a reason of at least 10 characters (zod validator,
 * priorityOverride.validators.ts) specifically so an override is never
 * indistinguishable from a silent, unexplained reordering of the queue —
 * this form enforces the same minimum client-side so the error is caught
 * before a round trip, not instead of the server-side check.
 */
export function OverridePriorityModal({ isOpen, onClose, entry, onOverridden }: OverridePriorityModalProps) {
  const [overrideValue, setOverrideValue] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function resetAndClose() {
    setOverrideValue("");
    setReason("");
    setFormError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!entry) return;

    const numericValue = Number(overrideValue);
    if (overrideValue.trim() === "" || Number.isNaN(numericValue) || numericValue < 0) {
      setFormError("Enter a valid, non-negative priority value.");
      return;
    }
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setFormError(`Provide a documented reason of at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await priorityService.override(entry.id, { overrideValue: numericValue, reason: reason.trim() });
      onOverridden();
      resetAndClose();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!entry) return null;

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Override priority">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="font-medium text-navy-900">
            {entry.patient.firstName} {entry.patient.lastName}
          </p>
          <p className="text-sm text-slate-500">
            {entry.patient.patientNumber} · {entry.queueNumber} · current effective priority{" "}
            <strong>{entry.effectivePriority}</strong>
          </p>
        </div>

        <div className="rounded-md border border-warning-100 bg-warning-50 px-3 py-2.5 text-sm text-warning-700">
          This replaces the calculated priority for this patient only. It does not change how priority is calculated
          for anyone else, and it is recorded in the audit log with your name and reason.
        </div>

        <Input
          label="New priority value"
          type="number"
          min={0}
          step={1}
          required
          value={overrideValue}
          onChange={(e) => setOverrideValue(e.target.value)}
          placeholder="e.g. 150"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="override-reason" className="text-sm font-medium text-slate-700">
            Reason
            <span className="ml-0.5 text-danger-600" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> required</span>
          </label>
          <textarea
            id="override-reason"
            required
            minLength={MIN_REASON_LENGTH}
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this patient's priority is being changed manually (minimum 10 characters)."
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:border-brand-500"
          />
          <p className="text-xs text-slate-400">{reason.trim().length}/{MIN_REASON_LENGTH} characters minimum</p>
        </div>

        {formError && (
          <p role="alert" className="text-sm text-danger-600">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={isSubmitting}>
            Apply override
          </Button>
        </div>
      </form>
    </Modal>
  );
}
