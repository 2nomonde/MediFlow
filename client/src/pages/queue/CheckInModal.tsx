import { useEffect, useState, type FormEvent } from "react";
import { Search, AlertTriangle, ArrowLeft } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { patientService } from "@/services/patient.service";
import { departmentService } from "@/services/department.service";
import { queueService } from "@/services/queue.service";
import { getErrorMessage } from "@/services/api";
import { isConflictError } from "@/utils/apiValidation";
import type { Patient } from "@/types/patient";
import type { Department, QueueEntry } from "@/types/queue";

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckedIn: (entry: QueueEntry) => void;
}

export function CheckInModal({ isOpen, onClose, onCheckedIn }: CheckInModalProps) {
  const [step, setStep] = useState<"search" | "confirm">("search");

  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Reset on every open so a previous check-in doesn't linger.
    setStep("search");
    setSearchInput("");
    setResults([]);
    setHasSearched(false);
    setSelectedPatient(null);
    setDepartmentId("");
    setIsEmergency(false);
    setSubmitError(null);

    departmentService
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]));
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
    setStep("confirm");
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    if (!selectedPatient || !departmentId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const entry = await queueService.checkIn({
        patientId: selectedPatient.id,
        departmentId,
        isEmergency,
      });
      onCheckedIn(entry);
    } catch (error) {
      if (isConflictError(error)) {
        setSubmitError("This patient is already in an active queue.");
      } else {
        setSubmitError(getErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Check in patient">
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

      {step === "confirm" && selectedPatient && (
        <form onSubmit={handleConfirm} className="space-y-4">
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
          >
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
          {departments.length === 0 && (
            <p className="text-sm text-warning-700">
              No departments are configured yet. An administrator needs to add one before patients can be checked in.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-slate-300 text-danger-600 focus-visible:ring-2 focus-visible:ring-danger-500"
            />
            Emergency / fast-track this patient
          </label>

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
            <Button type="submit" isLoading={isSubmitting} disabled={!departmentId}>
              Confirm check-in
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
