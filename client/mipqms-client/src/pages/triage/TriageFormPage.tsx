import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { queueService } from "@/services/queue.service";
import { triageService } from "@/services/triage.service";
import { getErrorMessage } from "@/services/api";
import { extractFieldErrors, isConflictError } from "@/utils/apiValidation";
import { useToast } from "@/hooks/useToast";
import type { QueueEntry } from "@/types/queue";
import type { Triage, TriagePriority } from "@/types/triage";

interface FormValues {
  priorityLevel: TriagePriority | "";
  temperature: string;
  bloodPressureSys: string;
  bloodPressureDia: string;
  heartRate: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  weightKg: string;
  heightCm: string;
  bloodGlucose: string;
  painScore: string;
  symptoms: string;
  notes: string;
}

const EMPTY_FORM: FormValues = {
  priorityLevel: "",
  temperature: "",
  bloodPressureSys: "",
  bloodPressureDia: "",
  heartRate: "",
  respiratoryRate: "",
  oxygenSaturation: "",
  weightKg: "",
  heightCm: "",
  bloodGlucose: "",
  painScore: "",
  symptoms: "",
  notes: "",
};

function toFormValues(triage: Triage): FormValues {
  const numOrEmpty = (n: number | null) => (n === null ? "" : String(n));
  return {
    priorityLevel: triage.priorityLevel,
    temperature: numOrEmpty(triage.temperature),
    bloodPressureSys: numOrEmpty(triage.bloodPressureSys),
    bloodPressureDia: numOrEmpty(triage.bloodPressureDia),
    heartRate: numOrEmpty(triage.heartRate),
    respiratoryRate: numOrEmpty(triage.respiratoryRate),
    oxygenSaturation: numOrEmpty(triage.oxygenSaturation),
    weightKg: numOrEmpty(triage.weightKg),
    heightCm: numOrEmpty(triage.heightCm),
    bloodGlucose: numOrEmpty(triage.bloodGlucose),
    painScore: numOrEmpty(triage.painScore),
    symptoms: triage.symptoms ?? "",
    notes: triage.notes ?? "",
  };
}

function toApiInput(values: FormValues) {
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const str = (s: string) => (s.trim() === "" ? undefined : s.trim());
  return {
    priorityLevel: values.priorityLevel as TriagePriority,
    temperature: num(values.temperature),
    bloodPressureSys: num(values.bloodPressureSys),
    bloodPressureDia: num(values.bloodPressureDia),
    heartRate: num(values.heartRate),
    respiratoryRate: num(values.respiratoryRate),
    oxygenSaturation: num(values.oxygenSaturation),
    weightKg: num(values.weightKg),
    heightCm: num(values.heightCm),
    bloodGlucose: num(values.bloodGlucose),
    painScore: num(values.painScore),
    symptoms: str(values.symptoms),
    notes: str(values.notes),
  };
}

export function TriageFormPage() {
  const { queueEntryId } = useParams<{ queueEntryId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [existingTriage, setExistingTriage] = useState<Triage | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!queueEntryId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const entry = await queueService.getById(queueEntryId);
      setQueueEntry(entry);

      try {
        const triage = await triageService.getByQueueEntry(queueEntryId);
        setExistingTriage(triage);
        setValues(toFormValues(triage));
      } catch {
        // No triage yet — that's expected and means we're creating one.
        setExistingTriage(null);
        setValues(EMPTY_FORM);
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

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!queueEntryId || !values.priorityLevel) return;

    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (existingTriage) {
        await triageService.update(existingTriage.id, toApiInput(values));
        showToast("success", "Triage record updated.");
      } else {
        await triageService.create({ queueEntryId, ...toApiInput(values) });
        showToast("success", "Triage recorded successfully.");
      }
      navigate("/triage");
    } catch (error) {
      if (isConflictError(error)) {
        setFormError("A triage record already exists for this patient's current visit.");
      } else {
        setFieldErrors(extractFieldErrors(error));
        setFormError(getErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
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

  return (
    <>
      <PageHeader
        title={existingTriage ? "Edit triage record" : "Start triage"}
        breadcrumbs={[
          { label: "Dashboard", path: "/dashboard" },
          { label: "Triage", path: "/triage" },
          { label: queueEntry.queueNumber },
        ]}
      />

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-navy-900">
              {queueEntry.patient.firstName} {queueEntry.patient.lastName}
            </p>
            <p className="text-sm text-slate-500">
              {queueEntry.patient.patientNumber} · {queueEntry.department.name} · Queue {queueEntry.queueNumber}
            </p>
          </div>
          {queueEntry.isEmergency && <Badge tone="danger">Flagged emergency at check-in</Badge>}
        </CardBody>
      </Card>

      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <p>{formError}</p>
          <Link to="/triage" className="mt-1 inline-block font-medium underline">
            Back to triage list
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-navy-900">Assessment</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Triage priority"
              required
              value={values.priorityLevel}
              onChange={(e) => update("priorityLevel", e.target.value as TriagePriority)}
              error={fieldErrors.priorityLevel}
              disabled={isSubmitting}
            >
              <option value="">Select priority</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </Select>
            <Input
              label="Pain score (0–10)"
              type="number"
              min={0}
              max={10}
              value={values.painScore}
              onChange={(e) => update("painScore", e.target.value)}
              error={fieldErrors.painScore}
              disabled={isSubmitting}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-navy-900">Vital signs</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Temperature (°C)"
              type="number"
              step="0.1"
              value={values.temperature}
              onChange={(e) => update("temperature", e.target.value)}
              error={fieldErrors.temperature}
              disabled={isSubmitting}
            />
            <Input
              label="Heart rate (bpm)"
              type="number"
              value={values.heartRate}
              onChange={(e) => update("heartRate", e.target.value)}
              error={fieldErrors.heartRate}
              disabled={isSubmitting}
            />
            <Input
              label="Respiratory rate (breaths/min)"
              type="number"
              value={values.respiratoryRate}
              onChange={(e) => update("respiratoryRate", e.target.value)}
              error={fieldErrors.respiratoryRate}
              disabled={isSubmitting}
            />
            <Input
              label="Blood pressure — systolic"
              type="number"
              value={values.bloodPressureSys}
              onChange={(e) => update("bloodPressureSys", e.target.value)}
              error={fieldErrors.bloodPressureSys}
              disabled={isSubmitting}
            />
            <Input
              label="Blood pressure — diastolic"
              type="number"
              value={values.bloodPressureDia}
              onChange={(e) => update("bloodPressureDia", e.target.value)}
              error={fieldErrors.bloodPressureDia}
              disabled={isSubmitting}
            />
            <Input
              label="Oxygen saturation (%)"
              type="number"
              min={0}
              max={100}
              value={values.oxygenSaturation}
              onChange={(e) => update("oxygenSaturation", e.target.value)}
              error={fieldErrors.oxygenSaturation}
              disabled={isSubmitting}
            />
            <Input
              label="Blood glucose (mmol/L)"
              type="number"
              step="0.1"
              value={values.bloodGlucose}
              onChange={(e) => update("bloodGlucose", e.target.value)}
              error={fieldErrors.bloodGlucose}
              disabled={isSubmitting}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-navy-900">Measurements</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Weight (kg)"
              type="number"
              step="0.1"
              value={values.weightKg}
              onChange={(e) => update("weightKg", e.target.value)}
              error={fieldErrors.weightKg}
              disabled={isSubmitting}
            />
            <Input
              label="Height (cm)"
              type="number"
              step="0.1"
              value={values.heightCm}
              onChange={(e) => update("heightCm", e.target.value)}
              error={fieldErrors.heightCm}
              disabled={isSubmitting}
              hint={existingTriage?.bmi ? `Current BMI on record: ${existingTriage.bmi}` : "BMI is calculated automatically once weight and height are saved."}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-navy-900">Symptoms &amp; notes</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4">
            <Input
              label="Reported symptoms"
              value={values.symptoms}
              onChange={(e) => update("symptoms", e.target.value)}
              error={fieldErrors.symptoms}
              disabled={isSubmitting}
            />
            <Input
              label="Assessment notes"
              hint="Staff observations only — not a diagnosis or treatment plan."
              value={values.notes}
              onChange={(e) => update("notes", e.target.value)}
              error={fieldErrors.notes}
              disabled={isSubmitting}
            />
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate("/triage")} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={!values.priorityLevel}>
            {existingTriage ? "Save changes" : "Save triage"}
          </Button>
        </div>
      </form>
    </>
  );
}
