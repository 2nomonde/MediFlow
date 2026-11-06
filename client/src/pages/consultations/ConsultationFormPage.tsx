import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stethoscope, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrescriptionSection } from "./PrescriptionSection";
import { queueService } from "@/services/queue.service";
import { consultationService } from "@/services/consultation.service";
import { getErrorMessage } from "@/services/api";
import { extractFieldErrors } from "@/utils/apiValidation";
import { useToast } from "@/hooks/useToast";
import type { QueueEntry } from "@/types/queue";
import type { Consultation, ConsultationClinicalFields } from "@/types/consultation";

interface FormValues {
  chiefComplaint: string;
  clinicalNotes: string;
  assessment: string;
  diagnosis: string;
  treatmentPlan: string;
}

const EMPTY_FORM: FormValues = { chiefComplaint: "", clinicalNotes: "", assessment: "", diagnosis: "", treatmentPlan: "" };

function toFormValues(c: Consultation): FormValues {
  return {
    chiefComplaint: c.chiefComplaint ?? "",
    clinicalNotes: c.clinicalNotes ?? "",
    assessment: c.assessment ?? "",
    diagnosis: c.diagnosis ?? "",
    treatmentPlan: c.treatmentPlan ?? "",
  };
}

function toApiInput(values: FormValues): ConsultationClinicalFields {
  const clean = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    chiefComplaint: clean(values.chiefComplaint),
    clinicalNotes: clean(values.clinicalNotes),
    assessment: clean(values.assessment),
    diagnosis: clean(values.diagnosis),
    treatmentPlan: clean(values.treatmentPlan),
  };
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export function ConsultationFormPage() {
  const { queueEntryId } = useParams<{ queueEntryId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [history, setHistory] = useState<Consultation[]>([]);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isCompleteConfirmOpen, setIsCompleteConfirmOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!queueEntryId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const entry = await queueService.getById(queueEntryId);
      setQueueEntry(entry);

      try {
        const existing = await consultationService.getByQueueEntry(queueEntryId);
        setConsultation(existing);
        setValues(toFormValues(existing));
        const patientHistory = await consultationService.getPatientHistory(entry.patient.id);
        setHistory(patientHistory.filter((h) => h.id !== existing.id));
      } catch {
        // No consultation started yet for this queue entry — expected.
        setConsultation(null);
      }
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [queueEntryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleStart() {
    if (!queueEntryId) return;
    setIsStarting(true);
    setFormError(null);
    try {
      const started = await consultationService.start(queueEntryId);
      setConsultation(started);
      setValues(toFormValues(started));
      showToast("success", "Consultation started.");
      // Refresh the queue entry so its status (now IN_CONSULTATION) is current.
      setQueueEntry(await queueService.getById(queueEntryId));
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSaveDraft(event: FormEvent) {
    event.preventDefault();
    if (!consultation) return;
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const updated = await consultationService.update(consultation.id, toApiInput(values));
      setConsultation(updated);
      showToast("success", "Consultation notes saved.");
    } catch (err) {
      setFieldErrors(extractFieldErrors(err));
      setFormError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleComplete() {
    if (!consultation) return;
    setIsCompleting(true);
    setFormError(null);
    try {
      await consultationService.complete(consultation.id, toApiInput(values));
      showToast("success", "Consultation completed. The queue entry is now closed.");
      navigate("/consultations");
    } catch (err) {
      setFormError(getErrorMessage(err));
      setIsCompleteConfirmOpen(false);
    } finally {
      setIsCompleting(false);
    }
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" label="Loading" />
      </div>
    );
  }

  if (loadError || !queueEntry) {
    return <ErrorState message={loadError ?? "Something went wrong."} onRetry={loadData} />;
  }

  const isCompleted = consultation?.completedAt != null;

  return (
    <>
      <PageHeader
        title={`${queueEntry.patient.firstName} ${queueEntry.patient.lastName}`}
        description={consultation ? "Consultation" : "Ready to start consultation"}
        breadcrumbs={[
          { label: "Dashboard", path: "/dashboard" },
          { label: "Consultations", path: "/consultations" },
          { label: queueEntry.queueNumber },
        ]}
      />

      <Card className="mb-6">
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Patient number</p>
            <p className="text-sm text-navy-900">{queueEntry.patient.patientNumber}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Age / gender</p>
            <p className="text-sm text-navy-900">
              {calculateAge(queueEntry.patient.dateOfBirth)} yrs · {queueEntry.patient.gender}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Department</p>
            <p className="text-sm text-navy-900">{queueEntry.department.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Triage priority</p>
            <p className="text-sm text-navy-900">{queueEntry.triagePriority ?? "Not triaged"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Checked in</p>
            <p className="text-sm text-navy-900">{new Date(queueEntry.checkInTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Consultation started</p>
            <p className="text-sm text-navy-900">
              {consultation?.startedAt ? new Date(consultation.startedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
            <Badge tone={isCompleted ? "success" : queueEntry.status === "IN_CONSULTATION" ? "brand" : "warning"}>
              {isCompleted ? "Completed" : queueEntry.status}
            </Badge>
          </div>
        </CardBody>
      </Card>

      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          {formError}
        </div>
      )}

      {!consultation ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Stethoscope className="h-8 w-8 text-brand-600" aria-hidden="true" />
          <p className="font-medium text-navy-900">Start this consultation</p>
          <p className="max-w-sm text-sm text-slate-500">
            This will move the patient to In Consultation and record the start time.
          </p>
          <Button onClick={handleStart} isLoading={isStarting}>
            Start consultation
          </Button>
        </Card>
      ) : (
        <form onSubmit={handleSaveDraft} className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-navy-900">Consultation details</h2>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-4">
              <Input
                label="Chief complaint"
                value={values.chiefComplaint}
                onChange={(e) => update("chiefComplaint", e.target.value)}
                error={fieldErrors.chiefComplaint}
                disabled={isSaving || isCompleted}
              />
              <Input
                label="History / clinical notes"
                value={values.clinicalNotes}
                onChange={(e) => update("clinicalNotes", e.target.value)}
                error={fieldErrors.clinicalNotes}
                disabled={isSaving || isCompleted}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-navy-900">Assessment</h2>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-4">
              <Input
                label="Assessment"
                value={values.assessment}
                onChange={(e) => update("assessment", e.target.value)}
                error={fieldErrors.assessment}
                disabled={isSaving || isCompleted}
              />
              <Input
                label="Diagnosis / clinical impression"
                value={values.diagnosis}
                onChange={(e) => update("diagnosis", e.target.value)}
                error={fieldErrors.diagnosis}
                disabled={isSaving || isCompleted}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-navy-900">Plan</h2>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-4">
              <Input
                label="Treatment / management plan"
                hint="Staff-entered plan only — not an automated recommendation."
                value={values.treatmentPlan}
                onChange={(e) => update("treatmentPlan", e.target.value)}
                error={fieldErrors.treatmentPlan}
                disabled={isSaving || isCompleted}
              />
            </CardBody>
          </Card>

          {!isCompleted && (
            <div className="flex justify-end gap-3">
              <Button type="submit" variant="secondary" isLoading={isSaving}>
                Save draft
              </Button>
              <Button type="button" onClick={() => setIsCompleteConfirmOpen(true)}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Complete consultation
              </Button>
            </div>
          )}
        </form>
      )}

      {consultation && (
        <div className="mt-6">
          <PrescriptionSection consultationId={consultation.id} isConsultationCompleted={isCompleted} />
        </div>
      )}

      <Card className="mt-8">
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Previous consultations</h2>
        </CardHeader>
        {history.length === 0 ? (
          <EmptyState title="No previous consultations" description="This patient's past consultation records will appear here." />
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((record) => (
              <div key={record.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-navy-900">
                    {record.completedAt ? new Date(record.completedAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "In progress"}
                  </span>
                  <span className="text-slate-400">
                    Dr. {record.doctor.firstName} {record.doctor.lastName} · {record.queueEntry.department.name}
                  </span>
                </div>
                {record.chiefComplaint && <p className="mt-1 text-slate-600">Chief complaint: {record.chiefComplaint}</p>}
                {record.diagnosis && <p className="text-slate-600">Diagnosis: {record.diagnosis}</p>}
                {record.treatmentPlan && <p className="text-slate-600">Plan: {record.treatmentPlan}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={isCompleteConfirmOpen}
        onCancel={() => setIsCompleteConfirmOpen(false)}
        onConfirm={handleComplete}
        title="Complete consultation"
        message="This will save the consultation, close the queue entry as Completed, and cannot be undone. Continue?"
        confirmLabel="Complete consultation"
        isLoading={isCompleting}
      />
    </>
  );
}
