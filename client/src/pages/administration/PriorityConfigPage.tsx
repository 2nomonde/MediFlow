import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { priorityConfigService } from "@/services/priorityConfig.service";
import { getErrorMessage } from "@/services/api";
import { extractFieldErrors } from "@/utils/apiValidation";
import { useToast } from "@/hooks/useToast";
import type { PriorityConfig } from "@/types/priorityConfig";

interface FormValues {
  triageWeight: string;
  emergencyBonus: string;
  waitingTimeWeightPerMinute: string;
  appointmentOnTimeBonus: string;
  vulnerabilityBonus: string;
}

function toFormValues(config: PriorityConfig): FormValues {
  return {
    triageWeight: String(config.triageWeight),
    emergencyBonus: String(config.emergencyBonus),
    waitingTimeWeightPerMinute: String(config.waitingTimeWeightPerMinute),
    appointmentOnTimeBonus: String(config.appointmentOnTimeBonus),
    vulnerabilityBonus: String(config.vulnerabilityBonus),
  };
}

const FIELD_META: { key: keyof FormValues; label: string; description: string }[] = [
  {
    key: "triageWeight",
    label: "Triage weight",
    description: "Multiplied by the patient's triage level (1–5). Controls how much clinical urgency affects ranking.",
  },
  {
    key: "emergencyBonus",
    label: "Emergency bonus",
    description: "Flat points added when a queue entry is flagged emergency at check-in.",
  },
  {
    key: "waitingTimeWeightPerMinute",
    label: "Waiting-time weight (per minute)",
    description: "Points added for every minute a patient has been waiting — lets longer waits gain priority over time.",
  },
  {
    key: "appointmentOnTimeBonus",
    label: "Appointment bonus",
    description: "Flat points added when the queue entry is linked to an appointment.",
  },
  {
    key: "vulnerabilityBonus",
    label: "Vulnerability bonus",
    description: "Flat points added when the patient has a recorded vulnerability category (elderly, pregnant, child, chronic condition).",
  },
];

export function PriorityConfigPage() {
  const { showToast } = useToast();

  const [config, setConfig] = useState<PriorityConfig | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const active = await priorityConfigService.getActive();
      setConfig(active);
      setValues(toFormValues(active));
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update(key: keyof FormValues, value: string) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values) return;

    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const updated = await priorityConfigService.updateActive({
        triageWeight: Number(values.triageWeight),
        emergencyBonus: Number(values.emergencyBonus),
        waitingTimeWeightPerMinute: Number(values.waitingTimeWeightPerMinute),
        appointmentOnTimeBonus: Number(values.appointmentOnTimeBonus),
        vulnerabilityBonus: Number(values.vulnerabilityBonus),
      });
      setConfig(updated);
      setValues(toFormValues(updated));
      showToast("success", "Priority configuration updated.");
    } catch (error) {
      setFieldErrors(extractFieldErrors(error));
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" label="Loading priority configuration" />
      </div>
    );
  }

  if (loadError || !config || !values) {
    return <ErrorState message={loadError ?? "Something went wrong."} onRetry={load} />;
  }

  return (
    <>
      <PageHeader
        title="Priority configuration"
        description="Adjust the weights the queue priority engine uses. Changes apply the next time priority is calculated."
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Queue", path: "/queue" }, { label: "Priority settings" }]}
      />

      <Card className="mb-4 p-4 text-sm text-slate-500">
        Active configuration: <span className="font-medium text-navy-900">{config.name}</span> · Formula: priority ={" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">triageWeight × triageLevel + emergencyBonus (if flagged) + waitingMinutes × timeWeight + appointmentBonus (if linked) + vulnerabilityBonus (if applicable)</code>
      </Card>

      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-navy-900">Scoring weights</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {FIELD_META.map((field) => (
              <div key={field.key}>
                <Input
                  label={field.label}
                  type="number"
                  min={0}
                  step="0.1"
                  required
                  value={values[field.key]}
                  onChange={(e) => update(field.key, e.target.value)}
                  error={fieldErrors[field.key]}
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-slate-400">{field.description}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            Save configuration
          </Button>
        </div>
      </form>
    </>
  );
}
