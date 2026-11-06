import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Stethoscope, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { TriagePriorityBadge } from "@/components/common/TriagePriorityBadge";
import { queueService } from "@/services/queue.service";
import { getErrorMessage } from "@/services/api";
import type { QueueEntry } from "@/types/queue";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ConsultationsPage() {
  const navigate = useNavigate();

  const [called, setCalled] = useState<QueueEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalled = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Reuses the existing Phase 9/11 queue list endpoint — a "ready
      // for consultation" worklist is just CALLED entries, so no new
      // backend endpoint was needed for this list.
      const { entries } = await queueService.list({ status: "CALLED", pageSize: 100 });
      setCalled(entries);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalled();
  }, [fetchCalled]);

  return (
    <>
      <PageHeader
        title="Consultations"
        description="Patients ready for consultation and their clinical records."
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Consultations" }]}
        actions={
          <Button variant="secondary" onClick={fetchCalled} disabled={isLoading}>
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Ready for consultation</h2>
        </CardHeader>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" label="Loading called patients" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchCalled} />
        ) : called.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No patients ready for consultation"
            description="Patients who have been called from the queue will appear here."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Queue #</TableHeaderCell>
                <TableHeaderCell>Patient</TableHeaderCell>
                <TableHeaderCell>Department</TableHeaderCell>
                <TableHeaderCell>Triage</TableHeaderCell>
                <TableHeaderCell>Called at</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Action</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {called.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.queueNumber}</TableCell>
                  <TableCell>
                    {entry.patient.firstName} {entry.patient.lastName}
                    <span className="ml-1 text-xs text-slate-400">{entry.patient.patientNumber}</span>
                  </TableCell>
                  <TableCell>{entry.department.name}</TableCell>
                  <TableCell>
                    {entry.triagePriority ? (
                      <TriagePriorityBadge priority={entry.triagePriority} />
                    ) : entry.isEmergency ? (
                      <span className="text-sm text-slate-400">Emergency (no triage)</span>
                    ) : (
                      <span className="text-sm text-slate-400">Not triaged</span>
                    )}
                  </TableCell>
                  <TableCell>{entry.calledTime ? formatTime(entry.calledTime) : "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => navigate(`/consultations/${entry.id}`)}>
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                      Start consultation
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
