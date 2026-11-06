import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatientForm, EMPTY_PATIENT_FORM } from "./PatientForm";
import { patientService } from "@/services/patient.service";
import { getErrorMessage } from "@/services/api";
import { extractFieldErrors, isConflictError, getConflictPatientId } from "@/utils/apiValidation";
import { useToast } from "@/hooks/useToast";
import type { CreatePatientInput } from "@/types/patient";

export function PatientRegisterPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicatePatientId, setDuplicatePatientId] = useState<string | null>(null);

  async function handleSubmit(input: CreatePatientInput) {
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    setDuplicatePatientId(null);
    try {
      const patient = await patientService.create(input);
      showToast("success", `${patient.firstName} ${patient.lastName} was registered successfully.`);
      navigate(`/patients/${patient.id}`);
    } catch (error) {
      if (isConflictError(error)) {
        // Deliberately calm, non-technical wording — this is an expected
        // outcome (someone re-registering an existing patient), not a
        // system failure.
        setFormError("A patient with this identification information already exists.");
        setDuplicatePatientId(getConflictPatientId(error) ?? null);
      } else {
        setFieldErrors(extractFieldErrors(error));
        setFormError(getErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Register patient"
        breadcrumbs={[
          { label: "Dashboard", path: "/dashboard" },
          { label: "Patients", path: "/patients" },
          { label: "Register" },
        ]}
      />

      {formError && (
        <div role="alert" className="mb-4 rounded-md border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <p>{formError}</p>
          {duplicatePatientId && (
            <Link to={`/patients/${duplicatePatientId}`} className="mt-1 inline-block font-medium underline">
              View the existing patient record
            </Link>
          )}
        </div>
      )}

      <PatientForm
        initialValues={EMPTY_PATIENT_FORM}
        fieldErrors={fieldErrors}
        isSubmitting={isSubmitting}
        submitLabel="Register patient"
        onSubmit={handleSubmit}
        onCancel={() => navigate("/patients")}
      />
    </>
  );
}
