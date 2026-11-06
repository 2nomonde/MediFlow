import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Pencil, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { patientService } from "@/services/patient.service";
import { getErrorMessage } from "@/services/api";
import type { Patient } from "@/types/patient";

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNSPECIFIED: "Not specified",
};

const VULNERABILITY_LABELS: Record<string, string> = {
  NONE: "None",
  ELDERLY: "Elderly",
  PREGNANT: "Pregnant",
  CHILD: "Child",
  CHRONIC_CONDITION: "Chronic condition",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-navy-900">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const fetchPatient = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await patientService.getById(id);
      setPatient(result);
    } catch (err) {
      if (typeof err === "object" && err !== null && "response" in err) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 404) {
          setNotFound(true);
          return;
        }
      }
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner size="lg" label="Loading patient" />
      </div>
    );
  }

  if (notFound) {
    return (
      <>
        <PageHeader
          title="Patient not found"
          breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Patients", path: "/patients" }, { label: "Not found" }]}
        />
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="text-sm text-slate-500">This patient record doesn't exist or may have been removed.</p>
          <Link to="/patients">
            <Button variant="secondary" size="sm">Back to patients</Button>
          </Link>
        </Card>
      </>
    );
  }

  if (error || !patient) {
    return <ErrorState message={error ?? "Something went wrong."} onRetry={fetchPatient} />;
  }

  return (
    <>
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        description={patient.patientNumber}
        breadcrumbs={[
          { label: "Dashboard", path: "/dashboard" },
          { label: "Patients", path: "/patients" },
          { label: patient.patientNumber },
        ]}
        actions={
          <Button variant="secondary" onClick={() => navigate(`/patients/${patient.id}/edit`)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit patient
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-navy-900">Personal details</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-4">
            <Field label="First name" value={patient.firstName} />
            <Field label="Last name" value={patient.lastName} />
            <Field label="Date of birth" value={formatDate(patient.dateOfBirth)} />
            <Field label="Gender" value={GENDER_LABELS[patient.gender] ?? patient.gender} />
            <div className="col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Vulnerability category</p>
              <div className="mt-1">
                <Badge tone={patient.vulnerabilityCategory === "NONE" ? "neutral" : "warning"}>
                  {VULNERABILITY_LABELS[patient.vulnerabilityCategory] ?? patient.vulnerabilityCategory}
                </Badge>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-navy-900">Identification &amp; contact</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-4">
            <Field label="ID / passport number" value={patient.idOrPassportNumber} />
            <Field label="Phone" value={patient.phone} />
            <Field label="Email" value={patient.email} />
            <div className="col-span-2">
              <Field label="Address" value={patient.address} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-navy-900">Emergency contact</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-4">
            <Field label="Name" value={patient.emergencyContactName} />
            <Field label="Phone" value={patient.emergencyContactPhone} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-navy-900">Clinical notes</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4">
            <Field label="Known allergies" value={patient.allergies} />
            <Field label="Chronic conditions" value={patient.chronicConditions} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p>
          Appointment, queue, triage, and consultation history will appear here once those modules are
          built in later phases. This profile currently shows only registered patient details.
        </p>
      </div>
    </>
  );
}
