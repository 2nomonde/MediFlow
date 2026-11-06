import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import type { CreatePatientInput, Gender, VulnerabilityCategory } from "@/types/patient";

export interface PatientFormValues {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // yyyy-mm-dd, matches <input type="date">
  gender: Gender | "";
  vulnerabilityCategory: VulnerabilityCategory;
  idOrPassportNumber: string;
  phone: string;
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  chronicConditions: string;
}

export const EMPTY_PATIENT_FORM: PatientFormValues = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  vulnerabilityCategory: "NONE",
  idOrPassportNumber: "",
  phone: "",
  email: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  allergies: "",
  chronicConditions: "",
};

interface PatientFormProps {
  initialValues: PatientFormValues;
  /** Shown read-only in edit mode — patientNumber is server-generated and immutable. */
  patientNumber?: string;
  fieldErrors: Record<string, string>;
  isSubmitting: boolean;
  submitLabel: string;
  onSubmit: (input: CreatePatientInput) => void;
  onCancel: () => void;
}

function validateClientSide(values: PatientFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  if (!values.dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
  else if (new Date(values.dateOfBirth) > new Date()) {
    errors.dateOfBirth = "Date of birth cannot be in the future.";
  }
  if (!values.gender) errors.gender = "Select a gender.";
  if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

/** Converts blank optional strings to undefined so they aren't sent as empty strings. */
function toApiInput(values: PatientFormValues): CreatePatientInput {
  const clean = (value: string) => (value.trim() === "" ? undefined : value.trim());
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    dateOfBirth: values.dateOfBirth,
    gender: values.gender as Gender,
    vulnerabilityCategory: values.vulnerabilityCategory,
    idOrPassportNumber: clean(values.idOrPassportNumber),
    phone: clean(values.phone),
    email: clean(values.email),
    address: clean(values.address),
    emergencyContactName: clean(values.emergencyContactName),
    emergencyContactPhone: clean(values.emergencyContactPhone),
    allergies: clean(values.allergies),
    chronicConditions: clean(values.chronicConditions),
  };
}

/**
 * Shared by PatientRegisterPage and PatientEditPage. Every field here
 * exists on the approved Phase 2 Patient model — nothing invented.
 * Backend validation (Phase 7 validators/patient.validators.ts) remains
 * authoritative; this is a UX convenience so obvious mistakes are caught
 * before a round trip.
 */
export function PatientForm({
  initialValues,
  patientNumber,
  fieldErrors: serverFieldErrors,
  isSubmitting,
  submitLabel,
  onSubmit,
  onCancel,
}: PatientFormProps) {
  const [values, setValues] = useState<PatientFormValues>(initialValues);
  const [clientFieldErrors, setClientFieldErrors] = useState<Record<string, string>>({});

  // Server errors take precedence for a field once returned (they're the
  // authoritative check); client errors fill in before the first submit.
  const fieldErrors = { ...clientFieldErrors, ...serverFieldErrors };

  function update<K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = validateClientSide(values);
    setClientFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSubmit(toApiInput(values));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {patientNumber && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-500">Patient number: </span>
          <span className="font-medium text-navy-900">{patientNumber}</span>
          <span className="ml-2 text-xs text-slate-400">(system-assigned, cannot be changed)</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Personal details</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            required
            value={values.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            error={fieldErrors.firstName}
            disabled={isSubmitting}
          />
          <Input
            label="Last name"
            required
            value={values.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            error={fieldErrors.lastName}
            disabled={isSubmitting}
          />
          <Input
            label="Date of birth"
            type="date"
            required
            value={values.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
            error={fieldErrors.dateOfBirth}
            disabled={isSubmitting}
            max={new Date().toISOString().split("T")[0]}
          />
          <Select
            label="Gender"
            required
            value={values.gender}
            onChange={(e) => update("gender", e.target.value as Gender)}
            error={fieldErrors.gender}
            disabled={isSubmitting}
          >
            <option value="">Select gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="UNSPECIFIED">Prefer not to say</option>
          </Select>
          <Select
            label="Vulnerability category"
            value={values.vulnerabilityCategory}
            onChange={(e) => update("vulnerabilityCategory", e.target.value as VulnerabilityCategory)}
            error={fieldErrors.vulnerabilityCategory}
            disabled={isSubmitting}
          >
            <option value="NONE">None</option>
            <option value="ELDERLY">Elderly</option>
            <option value="PREGNANT">Pregnant</option>
            <option value="CHILD">Child</option>
            <option value="CHRONIC_CONDITION">Chronic condition</option>
          </Select>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Identification</h2>
        </CardHeader>
        <CardBody>
          <Input
            label="ID or passport number"
            hint="Used to prevent duplicate patient records. Leave blank if unavailable."
            value={values.idOrPassportNumber}
            onChange={(e) => update("idOrPassportNumber", e.target.value)}
            error={fieldErrors.idOrPassportNumber}
            disabled={isSubmitting}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Contact details</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Phone number"
            type="tel"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            error={fieldErrors.phone}
            disabled={isSubmitting}
          />
          <Input
            label="Email"
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            error={fieldErrors.email}
            disabled={isSubmitting}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Address</h2>
        </CardHeader>
        <CardBody>
          <Input
            label="Home address"
            value={values.address}
            onChange={(e) => update("address", e.target.value)}
            error={fieldErrors.address}
            disabled={isSubmitting}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Emergency contact</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Contact name"
            value={values.emergencyContactName}
            onChange={(e) => update("emergencyContactName", e.target.value)}
            error={fieldErrors.emergencyContactName}
            disabled={isSubmitting}
          />
          <Input
            label="Contact phone"
            type="tel"
            value={values.emergencyContactPhone}
            onChange={(e) => update("emergencyContactPhone", e.target.value)}
            error={fieldErrors.emergencyContactPhone}
            disabled={isSubmitting}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Clinical notes</h2>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Known allergies"
            value={values.allergies}
            onChange={(e) => update("allergies", e.target.value)}
            error={fieldErrors.allergies}
            disabled={isSubmitting}
          />
          <Input
            label="Chronic conditions"
            value={values.chronicConditions}
            onChange={(e) => update("chronicConditions", e.target.value)}
            error={fieldErrors.chronicConditions}
            disabled={isSubmitting}
          />
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
