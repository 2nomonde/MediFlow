import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, RefreshCw, PhoneCall, ListOrdered, Users, Info, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { QueueStatusBadge } from "@/components/common/QueueStatusBadge";
import { TriagePriorityBadge } from "@/components/common/TriagePriorityBadge";
import { PriorityBreakdownModal } from "@/components/common/PriorityBreakdownModal";
import { CheckInModal } from "./CheckInModal";
import { OverridePriorityModal } from "./OverridePriorityModal";
import { EstimateDetailsModal } from "./EstimateDetailsModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { queueService } from "@/services/queue.service";
import { departmentService } from "@/services/department.service";
import { waitEstimateService } from "@/services/waitEstimate.service";
import { getErrorMessage } from "@/services/api";
import { getAvailableActions } from "@/utils/queueTransitions";
import { formatMinutes } from "@/utils/formatMinutes";
import type { QueueEntry, QueueStatus, Department } from "@/types/queue";
import type { WaitEstimate } from "@/types/waitEstimate";

const CAN_CHECK_IN_ROLES = ["RECEPTIONIST", "ADMIN"];
const CAN_CALL_NEXT_ROLES = ["NURSE", "DOCTOR", "ADMIN"];
const CAN_OVERRIDE_PRIORITY_ROLES = ["NURSE", "DOCTOR", "ADMIN"];
// Matches the backend's CLINICAL_PRIORITY_ROLES in queue.service.ts —
// RECEPTIONIST sees the score but never the breakdown/override detail.
// This gate is a UX convenience only: the backend never sends
// priorityBreakdown/manualOverride/overrideReason/overriddenBy/
// overriddenAt to a RECEPTIONIST in the first place, so even if this
// check were bypassed there would be nothing sensitive to show.
const CAN_VIEW_PRIORITY_BREAKDOWN_ROLES = ["NURSE", "DOCTOR", "ADMIN"];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatWaiting(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

export function QueuePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [counts, setCounts] = useState<Record<QueueStatus, number> | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatus | "">("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCallingNext, setIsCallingNext] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ entry: QueueEntry; status: QueueStatus; label: string } | null>(null);
  const [breakdownEntry, setBreakdownEntry] = useState<QueueEntry | null>(null);
  const [overrideEntry, setOverrideEntry] = useState<QueueEntry | null>(null);
  const [estimateEntry, setEstimateEntry] = useState<QueueEntry | null>(null);
  const [estimates, setEstimates] = useState<Record<string, WaitEstimate>>({});
  const [loadingEstimateIds, setLoadingEstimateIds] = useState<Set<string>>(new Set());

  const canCheckIn = user ? CAN_CHECK_IN_ROLES.includes(user.role) : false;
  const canCallNext = user ? CAN_CALL_NEXT_ROLES.includes(user.role) : false;
  const canOverridePriority = user ? CAN_OVERRIDE_PRIORITY_ROLES.includes(user.role) : false;
  const canViewPriorityBreakdown = user ? CAN_VIEW_PRIORITY_BREAKDOWN_ROLES.includes(user.role) : false;

  /**
   * Estimates are fetched only for WAITING rows, in parallel, after the
   * main queue list resolves — not eagerly for every row regardless of
   * status. CALLED/IN_CONSULTATION/terminal rows get a static label
   * derived from `entry.status` alone (see the table below) without a
   * network call at all, since the backend's own answer for those
   * cases is always the same fixed message. This keeps the extra
   * request count proportional to how many patients are actually
   * waiting, not the whole queue.
   */
  const fetchEstimates = useCallback(async (waitingEntries: QueueEntry[]) => {
    const ids = waitingEntries.map((e) => e.id);
    if (ids.length === 0) return;
    setLoadingEstimateIds(new Set(ids));
    const results = await Promise.allSettled(ids.map((id) => waitEstimateService.getEstimate(id)));
    setEstimates((prev) => {
      const next = { ...prev };
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          next[ids[index]] = result.value;
        }
      });
      return next;
    });
    setLoadingEstimateIds(new Set());
  }, []);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [list, waiting, called, inConsultation, completed] = await Promise.all([
        queueService.list({
          departmentId: departmentFilter || undefined,
          status: statusFilter || undefined,
          pageSize: 100,
        }),
        queueService.count("WAITING"),
        queueService.count("CALLED"),
        queueService.count("IN_CONSULTATION"),
        queueService.count("COMPLETED"),
      ]);
      setEntries(list.entries);
      setCounts({ WAITING: waiting, CALLED: called, IN_CONSULTATION: inConsultation, COMPLETED: completed, CANCELLED: 0, NO_SHOW: 0 });
      fetchEstimates(list.entries.filter((e) => e.status === "WAITING"));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [departmentFilter, statusFilter, fetchEstimates]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    departmentService.list().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  async function handleCallNext() {
    if (!departmentFilter) return;
    setIsCallingNext(true);
    try {
      const entry = await queueService.callNext(departmentFilter);
      showToast("success", `${entry.patient.firstName} ${entry.patient.lastName} (${entry.queueNumber}) has been called.`);
      fetchQueue();
    } catch (error) {
      showToast("danger", getErrorMessage(error));
    } finally {
      setIsCallingNext(false);
    }
  }

  async function applyStatusChange(entry: QueueEntry, status: QueueStatus) {
    setPendingActionId(entry.id);
    try {
      await queueService.updateStatus(entry.id, status);
      showToast("success", `Queue entry updated.`);
      fetchQueue();
    } catch (error) {
      showToast("danger", getErrorMessage(error));
    } finally {
      setPendingActionId(null);
      setConfirmTarget(null);
    }
  }

  function handleAction(entry: QueueEntry, status: QueueStatus, label: string, needsConfirmation: boolean) {
    if (needsConfirmation) {
      setConfirmTarget({ entry, status, label });
    } else {
      applyStatusChange(entry, status);
    }
  }

  return (
    <>
      <PageHeader
        title="Queue Management"
        description="Manage patient check-ins and monitor the current queue, ordered by calculated priority."
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Queue" }]}
        actions={
          <>
            {canCheckIn && (
              <Button onClick={() => setIsCheckInOpen(true)}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Check in patient
              </Button>
            )}
            {user?.role === "ADMIN" && (
              <Link to="/administration/priority-config">
                <Button variant="secondary">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  Priority settings
                </Button>
              </Link>
            )}
            <Button variant="secondary" onClick={fetchQueue} disabled={isLoading}>
              <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Waiting" value={counts ? counts.WAITING : "No live data yet"} icon={ListOrdered} tone="warning" isPlaceholder={!counts} />
        <StatCard label="Called" value={counts ? counts.CALLED : "No live data yet"} icon={PhoneCall} tone="brand" isPlaceholder={!counts} />
        <StatCard label="In consultation" value={counts ? counts.IN_CONSULTATION : "No live data yet"} icon={Users} tone="brand" isPlaceholder={!counts} />
        <StatCard label="Completed today" value={counts ? counts.COMPLETED : "No live data yet"} icon={Users} tone="success" isPlaceholder={!counts} />
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Select label="Department" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as QueueStatus | "")}>
              <option value="">All statuses</option>
              <option value="WAITING">Waiting</option>
              <option value="CALLED">Called</option>
              <option value="IN_CONSULTATION">In consultation</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No-show</option>
            </Select>
          </div>
          {canCallNext && (
            <Button
              variant="secondary"
              onClick={handleCallNext}
              isLoading={isCallingNext}
              disabled={!departmentFilter}
              title={!departmentFilter ? "Select a department to call the next patient" : undefined}
            >
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              Call next in department
            </Button>
          )}
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading queue" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchQueue} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title="No patients in the queue"
            description="Checked-in patients for today will appear here."
            action={
              canCheckIn && (
                <Button size="sm" onClick={() => setIsCheckInOpen(true)}>
                  Check in patient
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Queue #</TableHeaderCell>
                <TableHeaderCell>Patient</TableHeaderCell>
                <TableHeaderCell>Department</TableHeaderCell>
                <TableHeaderCell>Triage</TableHeaderCell>
                <TableHeaderCell>Waiting</TableHeaderCell>
                <TableHeaderCell>Priority</TableHeaderCell>
                <TableHeaderCell>Estimated wait</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => {
                const actions = user ? getAvailableActions(entry.status, user.role) : [];
                return (
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
                    <TableCell>
                      {entry.triagePriority ? <TriagePriorityBadge priority={entry.triagePriority} /> : <span className="text-sm text-slate-400">Not triaged</span>}
                    </TableCell>
                    <TableCell>{formatTime(entry.checkInTime)} · {formatWaiting(entry.waitingMinutes)}</TableCell>
                    <TableCell>
                      {canViewPriorityBreakdown ? (
                        <button
                          type="button"
                          onClick={() => setBreakdownEntry(entry)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-navy-900 hover:bg-slate-100"
                          title="Why this patient is ranked here"
                        >
                          {entry.effectivePriority}
                          <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="font-medium text-navy-900">{entry.effectivePriority}</span>
                      )}
                      {entry.hasManualOverride && (
                        <Badge tone="warning" className="ml-1.5">
                          Overridden
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.status === "CALLED" ? (
                        <span className="text-sm text-slate-400">Already called</span>
                      ) : entry.status === "IN_CONSULTATION" ? (
                        <span className="text-sm text-slate-400">In consultation</span>
                      ) : entry.status !== "WAITING" ? (
                        <span className="text-sm text-slate-400">—</span>
                      ) : loadingEstimateIds.has(entry.id) ? (
                        <LoadingSpinner size="sm" label="Calculating estimate" />
                      ) : estimates[entry.id] ? (
                        <button
                          type="button"
                          onClick={() => setEstimateEntry(entry)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium text-navy-900 hover:bg-slate-100"
                          title="How this estimate was calculated"
                        >
                          {estimates[entry.id].estimateAvailable ? (
                            <>~{formatMinutes(estimates[entry.id].estimatedWaitMinutes ?? 0)}</>
                          ) : (
                            <span className="text-slate-400">Unavailable</span>
                          )}
                          <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <QueueStatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {actions.map((action) => (
                          <Button
                            key={action.targetStatus}
                            variant={action.targetStatus === "CANCELLED" || action.targetStatus === "NO_SHOW" ? "ghost" : "secondary"}
                            size="sm"
                            isLoading={pendingActionId === entry.id}
                            onClick={() => handleAction(entry, action.targetStatus, action.label, action.needsConfirmation)}
                          >
                            {action.label}
                          </Button>
                        ))}
                        {canOverridePriority && (entry.status === "WAITING" || entry.status === "CALLED") && (
                          <Button variant="ghost" size="sm" onClick={() => setOverrideEntry(entry)}>
                            Override
                          </Button>
                        )}
                        {actions.length === 0 && !canOverridePriority && <span className="text-sm text-slate-400">—</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <CheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        onCheckedIn={(entry) => {
          setIsCheckInOpen(false);
          showToast("success", `${entry.patient.firstName} ${entry.patient.lastName} checked in as ${entry.queueNumber}.`);
          fetchQueue();
        }}
      />

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && applyStatusChange(confirmTarget.entry, confirmTarget.status)}
        title={confirmTarget?.label ?? "Confirm"}
        message={
          confirmTarget
            ? `Are you sure you want to mark ${confirmTarget.entry.patient.firstName} ${confirmTarget.entry.patient.lastName} as "${confirmTarget.label}"? This cannot be undone.`
            : ""
        }
        confirmLabel={confirmTarget?.label ?? "Confirm"}
        isDangerous
        isLoading={pendingActionId === confirmTarget?.entry.id}
      />

      <PriorityBreakdownModal isOpen={breakdownEntry !== null} onClose={() => setBreakdownEntry(null)} entry={breakdownEntry} />

      <OverridePriorityModal
        isOpen={overrideEntry !== null}
        onClose={() => setOverrideEntry(null)}
        entry={overrideEntry}
        onOverridden={() => {
          showToast("success", "Priority override saved.");
          setOverrideEntry(null);
          fetchQueue();
        }}
      />

      <EstimateDetailsModal
        isOpen={estimateEntry !== null}
        onClose={() => setEstimateEntry(null)}
        queueEntryId={estimateEntry?.id ?? null}
        patientLabel={estimateEntry ? `${estimateEntry.patient.firstName} ${estimateEntry.patient.lastName} · ${estimateEntry.queueNumber}` : ""}
      />
    </>
  );
}
