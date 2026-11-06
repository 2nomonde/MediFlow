import { useEffect, useState, type FormEvent } from "react";
import { Search, AlertTriangle, ArrowLeft } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { patientService } from "@/services/patient.service";
import { departmentService } from "@/services/department.service";
import { userService, type StaffSummary } from "@/services/user.service";
import { appointmentService } from "@/services/appointment.service";
import { getErrorMessage } from "@/services/api";
import { extractFieldErrors } from "@/utils/apiValidation";
import type { Patient } from "@/types/patient";
import type { Department } from "@/types/queue";
import type { Appointment } from "@/types/appointment";

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (appointment: Appointment) => void;
}

/**
 * `datetime-local` has no timezone suffix, so `new Date(value)` parses
 * it in the browser's local time zone — matching how the receptionist
 * actually reads the clock on the wall, and how every other date input
 * in this project (e.g. CheckInModal's confirm step) is kept simple and
 * local-time-based rather than mixing UTC assumptions in.
 */
function toIsoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function minDateTimeLocal(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function NewAppointmentModal({ isOpen, onClose, onCreated }: NewAppointmentModalProps) {
  const [step, setStep] = useState<"search" | "details">("search");

  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<StaffSummary[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setStep("search");
    setSearchInput("");
    setResults([]);
    setHasSearched(false);
    setSelectedPatient(null);
    setDepartmentId("");
    setDoctorId("");
    setScheduledAt("");
    setReason("");
    setSubmitError(null);
    setFieldErrors({});

    departmentService.list().then(setDepartments).catch(() => setDepartments([]));
    userService.listByRole("DOCTOR").then(setDoctors).catch(() => setDoctors([]));
  }, [isOpen]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (!searchInput.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const { patients } = await patientService.list({ search: searchInput.trim(), pageSize: 10 });
      setResults(patients);
    } catch (error) {
      setSearchError(getErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  }

  function selectPatient(patient: Patient) {
    setSelectedPatient(patient);
    setStep("details");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedPatient || !departmentId || !doctorId || !scheduledAt) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});
    try {
      const appointment = await appointmentService.create({
        patientId: selectedPatient.id,
        departmentId,
        doctorId,
        scheduledAt: toIsoFromLocalInput(scheduledAt),
        reason: reason.trim() || undefined,
      });
      onCreated(appointment);
    } catch (error) {
      const fields = extractFieldErrors(error);
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields);
      } else {
        setSubmitError(getErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule appointment">
      {step === "search" && (
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Find patient"
                placeholder="Patient number, name, ID/passport, or phone"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" variant="secondary" isLoading={isSearching}>
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
          </form>

          {searchError && <p className="text-sm text-danger-600">{searchError}</p>}

          {isSearching ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner label="Searching" />
            </div>
          ) : hasSearched && results.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No patients match that search. Try a different name, number, or phone.
            </p>
          ) : results.length > 0 ? (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {results.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => selectPatient(patient)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                  >
                    <span>
                      <span className="font-medium text-navy-900">
                        {patient.firstName} {patient.lastName}
                      </span>
                      <span className="ml-2 text-slate-400">{patient.patientNumber}</span>
                    </span>
                    <span className="text-xs text-slate-400">Select</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {step === "details" && selectedPatient && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("search")}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Choose a different patient
          </button>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-medium text-navy-900">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </p>
            <p className="text-sm text-slate-500">{selectedPatient.patientNumber}</p>
          </div>

          <Select
            label="Department"
            required
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            disabled={isSubmitting || departments.length === 0}
            error={fieldErrors.departmentId}
          >
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>

          <Select
            label="Doctor"
            required
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            disabled={isSubmitting || doctors.length === 0}
            error={fieldErrors.doctorId}
          >
            <option value="">Select a doctor</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.firstName} {doctor.lastName}
              </option>
            ))}
          </Select>
          {doctors.length === 0 && (
            <p className="text-sm text-warning-700">No doctor accounts are configured yet.</p>
          )}

          <Input
            label="Date and time"
            type="datetime-local"
            required
            min={minDateTimeLocal()}
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={isSubmitting}
            error={fieldErrors.scheduledAt}
          />

          <Input
            label="Reason for visit"
            placeholder="Optional"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            error={fieldErrors.reason}
          />

          {submitError && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{submitError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={!departmentId || !doctorId || !scheduledAt}>
              Schedule appointment
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
