import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { PatientForm, type PatientFormValues } from "./PatientForm";
import { patientService } from "@/services/patient.service";
import { getErrorMessage } from "@/services/api";
import { extractFieldErrors, isConflictError } from "@/utils/apiValidation";
import { useToast } from "@/hooks/useToast";
import type { CreatePatientInput, Patient } from "@/types/patient";

function toFormValues(patient: Patient): PatientFormValues {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth.split("T")[0],
    gender: patient.gender,
    vulnerabilityCategory: patient.vulnerabilityCategory,
    idOrPassportNumber: patient.idOrPassportNumber ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    address: patient.address ?? "",
    emergencyContactName: patient.emergencyContactName ?? "",
    emergencyContactPhone: patient.emergencyContactPhone ?? "",
    allergies: patient.allergies ?? "",
    chronicConditions: patient.chronicConditions ?? "",
  };
}

export function PatientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPatient = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      setPatient(await patientService.getById(id));
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  async function handleSubmit(input: CreatePatientInput) {
    if (!id) return;
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const updated = await patientService.update(id, input);
      showToast("success", "Patient details updated successfully.");
      navigate(`/patients/${updated.id}`);
    } catch (error) {
      if (isConflictError(error)) {
        setFormError("Another patient already uses this identification number.");
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
        <LoadingSpinner size="lg" label="Loading patient" />
      </div>
    );
  }

  if (loadError || !patient) {
    return <ErrorState message={loadError ?? "Something went wrong."} onRetry={fetchPatient} />;
  }

  return (
    <>
      <PageHeader
        title={`Edit ${patient.firstName} ${patient.lastName}`}
        breadcrumbs={[
          { label: "Dashboard", path: "/dashboard" },
          { label: "Patients", path: "/patients" },
          { label: patient.patientNumber, path: `/patients/${patient.id}` },
          { label: "Edit" },
        ]}
      />

      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {formError}
        </div>
      )}

      <PatientForm
        initialValues={toFormValues(patient)}
        patientNumber={patient.patientNumber}
        fieldErrors={fieldErrors}
        isSubmitting={isSubmitting}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/patients/${patient.id}`)}
      />
    </>
  );
}
