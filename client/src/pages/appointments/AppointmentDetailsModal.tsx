import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { AppointmentStatusBadge } from "@/components/common/AppointmentStatusBadge";
import type { Appointment } from "@/types/appointment";

interface AppointmentDetailsModalProps {
  appointment: Appointment | null;
  onClose: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-navy-900">{value}</span>
    </div>
  );
}

export function AppointmentDetailsModal({ appointment, onClose }: AppointmentDetailsModalProps) {
  return (
    <Modal isOpen={appointment !== null} onClose={onClose} title="Appointment details">
      {appointment && (
        <div className="space-y-1">
          <Row
            label="Patient"
            value={`${appointment.patient.firstName} ${appointment.patient.lastName} (${appointment.patient.patientNumber})`}
          />
          <Row label="Department" value={appointment.department.name} />
          <Row label="Doctor" value={`Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`} />
          <Row label="Date and time" value={formatDateTime(appointment.scheduledAt)} />
          <Row label="Reason" value={appointment.reason ?? "—"} />
          <Row label="Status" value={<AppointmentStatusBadge status={appointment.status} />} />
          <Row
            label="Queue check-in"
            value={appointment.queueEntry ? `Checked in (${appointment.queueEntry.status})` : "Not checked in yet"}
          />
          {appointment.status === "CANCELLED" && (
            <Row label="Cancellation reason" value={appointment.cancellationReason || "No reason given"} />
          )}
        </div>
      )}
    </Modal>
  );
}
