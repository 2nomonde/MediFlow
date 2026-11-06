import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { appointmentService } from "@/services/appointment.service";
import { getErrorMessage } from "@/services/api";
import { extractFieldErrors, isConflictError } from "@/utils/apiValidation";
import type { Appointment } from "@/types/appointment";

interface RescheduleModalProps {
  appointment: Appointment | null;
  onClose: () => void;
  onRescheduled: (appointment: Appointment) => void;
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function minDateTimeLocal(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function RescheduleModal({ appointment, onClose, onRescheduled }: RescheduleModalProps) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (appointment) {
      setScheduledAt(toLocalInputValue(appointment.scheduledAt));
      setError(null);
      setFieldErrors({});
    }
  }, [appointment]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!appointment || !scheduledAt) return;
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const updated = await appointmentService.reschedule(appointment.id, {
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      onRescheduled(updated);
    } catch (err) {
      if (isConflictError(err)) {
        setError("This doctor already has an appointment within 30 minutes of the requested time.");
      } else {
        const fields = extractFieldErrors(err);
        if (Object.keys(fields).length > 0) {
          setFieldErrors(fields);
        } else {
          setError(getErrorMessage(err));
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={appointment !== null} onClose={onClose} title="Reschedule appointment">
      {appointment && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-medium text-navy-900">
              {appointment.patient.firstName} {appointment.patient.lastName}
            </p>
            <p className="text-sm text-slate-500">
              Currently with Dr. {appointment.doctor.firstName} {appointment.doctor.lastName} &middot;{" "}
              {appointment.department.name}
            </p>
          </div>

          <Input
            label="New date and time"
            type="datetime-local"
            required
            min={minDateTimeLocal()}
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={isSubmitting}
            error={fieldErrors.scheduledAt}
          />

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={!scheduledAt}>
              Confirm new time
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
