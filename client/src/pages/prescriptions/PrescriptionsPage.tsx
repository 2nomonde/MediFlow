import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Pill } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PrescriptionStatusBadge } from "@/components/common/PrescriptionStatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { prescriptionService } from "@/services/prescription.service";
import { getErrorMessage } from "@/services/api";
import type { Prescription } from "@/types/prescription";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function PrescriptionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispenseTarget, setDispenseTarget] = useState<Prescription | null>(null);
  const [isDispensing, setIsDispensing] = useState(false);

  const canDispense = user?.role === "PHARMACIST";

  const fetchPending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPrescriptions(await prescriptionService.listPending());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  async function handleDispense() {
    if (!dispenseTarget) return;
    setIsDispensing(true);
    try {
      await prescriptionService.dispense(dispenseTarget.id);
      showToast("success", `${dispenseTarget.medicine.name} dispensed to ${dispenseTarget.consultation.patient.firstName} ${dispenseTarget.consultation.patient.lastName}.`);
      setDispenseTarget(null);
      fetchPending();
    } catch (err) {
      showToast("danger", getErrorMessage(err));
    } finally {
      setIsDispensing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Prescriptions"
        description="Prescriptions awaiting dispensing."
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Prescriptions" }]}
        actions={
          <Button variant="secondary" onClick={fetchPending} disabled={isLoading}>
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading pending prescriptions" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchPending} />
        ) : prescriptions.length === 0 ? (
          <EmptyState icon={Pill} title="No prescriptions awaiting dispensing" description="New prescriptions from doctors will appear here." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Patient</TableHeaderCell>
                <TableHeaderCell>Medicine</TableHeaderCell>
                <TableHeaderCell>Dosage</TableHeaderCell>
                <TableHeaderCell>Quantity</TableHeaderCell>
                <TableHeaderCell>Instructions</TableHeaderCell>
                <TableHeaderCell>Prescribed by</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Action</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prescriptions.map((rx) => (
                <TableRow key={rx.id}>
                  <TableCell>
                    {rx.consultation.patient.firstName} {rx.consultation.patient.lastName}
                    <span className="ml-1 text-xs text-slate-400">{rx.consultation.patient.patientNumber}</span>
                  </TableCell>
                  <TableCell>
                    {rx.medicine.name}
                    {rx.medicine.strength && <span className="ml-1 text-xs text-slate-400">{rx.medicine.strength}</span>}
                  </TableCell>
                  <TableCell>
                    {rx.dosage} · {rx.frequency} · {rx.duration}
                  </TableCell>
                  <TableCell>{rx.quantity}</TableCell>
                  <TableCell className="max-w-xs truncate" title={rx.instructions ?? undefined}>
                    {rx.instructions ?? "—"}
                  </TableCell>
                  <TableCell>
                    Dr. {rx.consultation.doctor.firstName} {rx.consultation.doctor.lastName}
                  </TableCell>
                  <TableCell>{formatDate(rx.createdAt)}</TableCell>
                  <TableCell>
                    <PrescriptionStatusBadge status={rx.status} />
                  </TableCell>
                  <TableCell>
                    {canDispense && (
                      <Button size="sm" onClick={() => setDispenseTarget(rx)}>
                        Dispense
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        isOpen={dispenseTarget !== null}
        onCancel={() => setDispenseTarget(null)}
        onConfirm={handleDispense}
        title="Dispense prescription"
        message={
          dispenseTarget
            ? `Confirm dispensing ${dispenseTarget.quantity} × ${dispenseTarget.medicine.name} to ${dispenseTarget.consultation.patient.firstName} ${dispenseTarget.consultation.patient.lastName}. This cannot be undone.`
            : ""
        }
        confirmLabel="Dispense"
        isLoading={isDispensing}
      />
    </>
  );
}
