import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pill, Plus, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PrescriptionStatusBadge } from "@/components/common/PrescriptionStatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { prescriptionService } from "@/services/prescription.service";
import { medicineService } from "@/services/medicine.service";
import { getErrorMessage } from "@/services/api";
import { extractFieldErrors } from "@/utils/apiValidation";
import { useToast } from "@/hooks/useToast";
import type { Prescription, CreatePrescriptionInput } from "@/types/prescription";
import type { Medicine } from "@/types/medicine";

interface PrescriptionSectionProps {
  consultationId: string;
  /** Once the consultation is completed, new prescriptions can no longer be added (server-enforced too — this only hides the form). */
  isConsultationCompleted: boolean;
}

interface FormValues {
  medicineId: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  quantity: string;
}

const EMPTY_FORM: FormValues = { medicineId: "", dosage: "", frequency: "", duration: "", route: "", instructions: "", quantity: "" };

export function PrescriptionSection({ consultationId, isConsultationCompleted }: PrescriptionSectionProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  // UX only — the backend's `prescriptionWrite` group (DOCTOR only)
  // remains the actual, independently-enforced authority. ADMIN keeps
  // full read access to this section (existing prescriptions, history)
  // but never sees the creation button, matching the backend rule.
  const canCreatePrescription = user?.role === "DOCTOR";

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rx, meds] = await Promise.all([
        prescriptionService.listByConsultation(consultationId),
        medicineService.list(),
      ]);
      setPrescriptions(rx);
      setMedicines(meds);
    } catch (err) {
      showToast("danger", getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  useEffect(() => {
    load();
  }, [load]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const input: CreatePrescriptionInput = {
      medicineId: values.medicineId,
      dosage: values.dosage.trim(),
      frequency: values.frequency.trim(),
      duration: values.duration.trim(),
      route: values.route.trim() || undefined,
      instructions: values.instructions.trim(),
      quantity: Number(values.quantity),
    };

    try {
      const { prescription, stockWarning } = await prescriptionService.create(consultationId, input);
      setPrescriptions((prev) => [...prev, prescription]);
      setValues(EMPTY_FORM);
      setIsFormOpen(false);
      showToast(
        stockWarning ? "warning" : "success",
        stockWarning
          ? `Prescription saved — note: current stock for ${prescription.medicine.name} may be insufficient.`
          : "Prescription saved."
      );
    } catch (err) {
      setFieldErrors(extractFieldErrors(err));
      setFormError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-navy-900">Prescriptions</h2>
        {!isConsultationCompleted && canCreatePrescription && !isFormOpen && (
          <Button size="sm" variant="secondary" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add medicine
          </Button>
        )}
      </CardHeader>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner label="Loading prescriptions" />
        </div>
      ) : (
        <CardBody className="space-y-4">
          {isFormOpen && (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-slate-200 p-4">
              {formError && (
                <p role="alert" className="text-sm text-danger-600">
                  {formError}
                </p>
              )}
              <Select
                label="Medicine"
                required
                value={values.medicineId}
                onChange={(e) => update("medicineId", e.target.value)}
                error={fieldErrors.medicineId}
                disabled={isSubmitting}
              >
                <option value="">Select medicine</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.strength ? `(${m.strength})` : ""} {m.dosageForm ? `— ${m.dosageForm}` : ""}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="Dosage"
                  placeholder="e.g. 1 tablet"
                  required
                  value={values.dosage}
                  onChange={(e) => update("dosage", e.target.value)}
                  error={fieldErrors.dosage}
                  disabled={isSubmitting}
                />
                <Input
                  label="Frequency"
                  placeholder="e.g. Twice daily"
                  required
                  value={values.frequency}
                  onChange={(e) => update("frequency", e.target.value)}
                  error={fieldErrors.frequency}
                  disabled={isSubmitting}
                />
                <Input
                  label="Duration"
                  placeholder="e.g. 7 days"
                  required
                  value={values.duration}
                  onChange={(e) => update("duration", e.target.value)}
                  error={fieldErrors.duration}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Route (optional)"
                  placeholder="e.g. Oral"
                  value={values.route}
                  onChange={(e) => update("route", e.target.value)}
                  error={fieldErrors.route}
                  disabled={isSubmitting}
                />
                <Input
                  label="Quantity"
                  type="number"
                  min={1}
                  required
                  value={values.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                  error={fieldErrors.quantity}
                  disabled={isSubmitting}
                />
              </div>
              <Input
                label="Instructions"
                required
                placeholder="e.g. Take with food"
                value={values.instructions}
                onChange={(e) => update("instructions", e.target.value)}
                error={fieldErrors.instructions}
                disabled={isSubmitting}
              />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  Save prescription
                </Button>
              </div>
            </form>
          )}

          {prescriptions.length === 0 && !isFormOpen ? (
            <EmptyState
              icon={Pill}
              title="No prescriptions yet"
              description={
                isConsultationCompleted
                  ? "No prescriptions were added to this consultation."
                  : canCreatePrescription
                    ? "Add a medicine to prescribe it for this visit."
                    : "No prescriptions have been added to this consultation yet."
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-navy-900">
                      {rx.medicine.name} {rx.medicine.strength && <span className="text-slate-400">({rx.medicine.strength})</span>}
                    </p>
                    <p className="text-slate-600">
                      {rx.dosage} · {rx.frequency} · {rx.duration} {rx.route && `· ${rx.route}`} · Qty {rx.quantity}
                    </p>
                    {rx.instructions && <p className="text-slate-500">{rx.instructions}</p>}
                  </div>
                  <PrescriptionStatusBadge status={rx.status} />
                </div>
              ))}
            </div>
          )}

          {isConsultationCompleted && prescriptions.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              This consultation is completed — its prescription history is retained but no new prescriptions can be added.
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
}
