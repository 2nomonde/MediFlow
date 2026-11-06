import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { appointmentService } from "@/services/appointment.service";
import { getErrorMessage } from "@/services/api";
import type { Appointment } from "@/types/appointment";

interface CancelAppointmentModalProps {
  appointment: Appointment | null;
  onClose: () => void;
  onCancelled: (appointment: Appointment) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Replaces the generic ConfirmDialog for this one action because the
 * brief asks to "cancel appointments with a recorded reason" — the
 * reason is optional (a receptionist may still cancel without typing
 * one), so this is its own small form rather than a plain yes/no
 * confirmation.
 */
export function CancelAppointmentModal({ appointment, onClose, onCancelled }: CancelAppointmentModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (appointment) {
      setReason("");
      setError(null);
    }
  }, [appointment]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!appointment) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await appointmentService.cancel(appointment.id, reason.trim() || undefined);
      onCancelled(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={appointment !== null} onClose={onClose} title="Cancel appointment">
      {appointment && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-medium text-navy-900">
              {appointment.patient.firstName} {appointment.patient.lastName}
            </p>
            <p className="text-sm text-slate-500">
              {formatDateTime(appointment.scheduledAt)} with Dr. {appointment.doctor.firstName}{" "}
              {appointment.doctor.lastName} &middot; {appointment.department.name}
            </p>
          </div>

          <p className="text-sm text-slate-600">
            This cancels the appointment. The record is kept, not deleted, and can still be viewed afterward.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cancel-reason" className="text-sm font-medium text-slate-700">
              Reason <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              maxLength={500}
              placeholder="e.g. Patient requested, scheduling conflict, no longer needed"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Keep appointment
            </Button>
            <Button type="submit" variant="danger" isLoading={isSubmitting}>
              Cancel appointment
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
