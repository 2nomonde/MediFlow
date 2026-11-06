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
import { Badge } from "@/components/ui/Badge";
import { TriagePriorityBadge } from "@/components/common/TriagePriorityBadge";
import { triageService } from "@/services/triage.service";
import { getErrorMessage } from "@/services/api";
import type { QueueEntry } from "@/types/queue";
import type { Triage } from "@/types/triage";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatWaiting(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function TriagePage() {
  const navigate = useNavigate();

  const [pending, setPending] = useState<QueueEntry[]>([]);
  const [isPendingLoading, setIsPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [recent, setRecent] = useState<Triage[]>([]);
  const [isRecentLoading, setIsRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setIsPendingLoading(true);
    setPendingError(null);
    try {
      setPending(await triageService.listPending());
    } catch (err) {
      setPendingError(getErrorMessage(err));
    } finally {
      setIsPendingLoading(false);
    }
  }, []);

  const fetchRecent = useCallback(async () => {
    setIsRecentLoading(true);
    setRecentError(null);
    try {
      const { records } = await triageService.list({ pageSize: 10 });
      setRecent(records);
    } catch (err) {
      setRecentError(getErrorMessage(err));
    } finally {
      setIsRecentLoading(false);
    }
  }, []);

  function refreshAll() {
    fetchPending();
    fetchRecent();
  }

  useEffect(() => {
    fetchPending();
    fetchRecent();
  }, [fetchPending, fetchRecent]);

  return (
    <>
      <PageHeader
        title="Triage"
        description="Assess patients and record initial clinical observations."
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Triage" }]}
        actions={
          <Button variant="secondary" onClick={refreshAll} disabled={isPendingLoading || isRecentLoading}>
            <RefreshCw className={isPendingLoading || isRecentLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Patients awaiting triage</h2>
        </CardHeader>
        {isPendingLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" label="Loading patients awaiting triage" />
          </div>
        ) : pendingError ? (
          <ErrorState message={pendingError} onRetry={fetchPending} />
        ) : pending.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No patients awaiting triage"
            description="Patients who have checked in and not yet been triaged will appear here."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Queue #</TableHeaderCell>
                <TableHeaderCell>Patient</TableHeaderCell>
                <TableHeaderCell>Department</TableHeaderCell>
                <TableHeaderCell>Check-in</TableHeaderCell>
                <TableHeaderCell>Waiting</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Action</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pending.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {entry.queueNumber}
                    {entry.isEmergency && (
                      <Badge tone="danger" className="ml-2">
                        Emergency
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.patient.firstName} {entry.patient.lastName}
                    <span className="ml-1 text-xs text-slate-400">{entry.patient.patientNumber}</span>
                  </TableCell>
                  <TableCell>{entry.department.name}</TableCell>
                  <TableCell>{formatTime(entry.checkInTime)}</TableCell>
                  <TableCell>{formatWaiting(entry.waitingMinutes)}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => navigate(`/triage/${entry.id}`)}>
                      Start triage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-navy-900">Recent triage records</h2>
        </CardHeader>
        {isRecentLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" label="Loading recent triage records" />
          </div>
        ) : recentError ? (
          <ErrorState message={recentError} onRetry={fetchRecent} />
        ) : recent.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No triage records yet" description="Recorded triage assessments will appear here." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Patient</TableHeaderCell>
                <TableHeaderCell>Department</TableHeaderCell>
                <TableHeaderCell>Priority</TableHeaderCell>
                <TableHeaderCell>Recorded by</TableHeaderCell>
                <TableHeaderCell>Recorded at</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Action</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recent.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    {record.queueEntry.patient.firstName} {record.queueEntry.patient.lastName}
                    <span className="ml-1 text-xs text-slate-400">{record.queueEntry.patient.patientNumber}</span>
                  </TableCell>
                  <TableCell>{record.queueEntry.department.name}</TableCell>
                  <TableCell>
                    <TriagePriorityBadge priority={record.priorityLevel} />
                  </TableCell>
                  <TableCell>
                    {record.recordedBy.firstName} {record.recordedBy.lastName}
                  </TableCell>
                  <TableCell>{new Date(record.recordedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/triage/${record.queueEntryId}`)}>
                      View / edit
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
