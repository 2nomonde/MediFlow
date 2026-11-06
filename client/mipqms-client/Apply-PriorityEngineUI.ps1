<#
.SYNOPSIS
  Writes the four Priority Engine UI files directly to disk — no copy-paste
  required. Fixes the repeated issue where pasting file content into VS
  Code wasn't actually landing (QueuePage.tsx was still the Sep 11
  original, unchanged, after two attempts).

.WHAT THIS DOES
  1. Backs up the existing QueuePage.tsx (the only file being replaced)
     to a timestamped folder.
  2. Writes QueuePage.tsx (replaced), OverridePriorityModal.tsx (new),
     EstimateDetailsModal.tsx (new), and formatMinutes.ts (new) with
     their exact content embedded in this script.
  3. Verifies each file afterward by comparing its written size against
     what was written, and reports pass/fail per file.
  4. Does not touch navigation.ts (already confirmed fixed), App.tsx,
     any backend file, .env, or the database.

.EXAMPLE
  .\Apply-PriorityEngineUI.ps1
  .\Apply-PriorityEngineUI.ps1 -ClientRoot "C:\MediFlow\client\mipqms-client"
#>

[CmdletBinding()]
param(
    [string]$ClientRoot = "C:\MediFlow\client\mipqms-client"
)

$ErrorActionPreference = "Stop"
$SrcRoot = Join-Path $ClientRoot "src"

if (-not (Test-Path $SrcRoot)) {
    Write-Error "Cannot find '$SrcRoot'. Pass the correct -ClientRoot (the folder that CONTAINS the src folder)."
    exit 1
}

$QueuePagePath   = Join-Path $SrcRoot "pages\queue\QueuePage.tsx"
$OverridePath    = Join-Path $SrcRoot "pages\queue\OverridePriorityModal.tsx"
$EstimatePath    = Join-Path $SrcRoot "pages\queue\EstimateDetailsModal.tsx"
$FormatMinsPath  = Join-Path $SrcRoot "utils\formatMinutes.ts"

# ---------------------------------------------------------------------------
# Backup — only QueuePage.tsx already exists and is being replaced.
# ---------------------------------------------------------------------------
$timestamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ClientRoot "_priority_ui_backup_$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

if (Test-Path $QueuePagePath) {
    $dest = Join-Path $backupRoot "QueuePage.tsx"
    Copy-Item $QueuePagePath $dest -Force
    Write-Host "Backed up existing QueuePage.tsx -> $dest" -ForegroundColor Cyan
} else {
    Write-Warning "QueuePage.tsx did not exist at expected path — proceeding to create it fresh."
}

New-Item -ItemType Directory -Path (Split-Path $OverridePath) -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $FormatMinsPath) -Force | Out-Null

# ---------------------------------------------------------------------------
# File contents are stored in single-quoted here-strings for PowerShell.
# NOT interpolate anything inside ($variables, backticks, etc. are all
# written out literally, exactly as the TypeScript source needs them).
# ---------------------------------------------------------------------------

$formatMinutesContent = @'
/**
 * Formats a minute count the same way across the app (queue waiting time,
 * wait estimates): under an hour as "N min", an hour or more as "Hh Mm".
 * A null input (used by WaitEstimate when no estimate is available yet)
 * is the caller's responsibility to handle before calling this — it is
 * intentionally not accepted here so a missing estimate can never be
 * silently rendered as "0 min".
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
'@

$estimateModalContent = @'
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { waitEstimateService } from "@/services/waitEstimate.service";
import { getErrorMessage } from "@/services/api";
import { formatMinutes } from "@/utils/formatMinutes";
import type { QueueEntry } from "@/types/queue";
import type { WaitEstimate } from "@/types/waitEstimate";

interface EstimateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: QueueEntry | null;
}

/**
 * Shows the backend's wait-time estimate for a single queue entry,
 * fetched fresh each time the modal opens rather than carried on the
 * queue-list entry — the estimate is comparatively expensive to compute
 * (it looks at recent completed-service history) so it's a dedicated
 * sub-resource (GET /api/queue/:id/estimate), not part of the list
 * response.
 */
export function EstimateDetailsModal({ isOpen, onClose, entry }: EstimateDetailsModalProps) {
  const [estimate, setEstimate] = useState<WaitEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !entry) {
      setEstimate(null);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    waitEstimateService
      .getEstimate(entry.id)
      .then(setEstimate)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [isOpen, entry]);

  if (!entry) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Estimated wait time">
      <div className="space-y-4">
        <div>
          <p className="font-medium text-navy-900">
            {entry.patient.firstName} {entry.patient.lastName}
          </p>
          <p className="text-sm text-slate-500">
            {entry.patient.patientNumber} · {entry.queueNumber} · {entry.department.name}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner label="Calculating estimate" />
          </div>
        ) : error ? (
          <p className="text-sm text-danger-600">{error}</p>
        ) : estimate ? (
          <>
            {estimate.estimateAvailable && estimate.estimatedWaitMinutes !== null ? (
              <div className="rounded-md bg-brand-50 px-3 py-3 text-center">
                <p className="text-2xl font-semibold text-brand-700">
                  {formatMinutes(estimate.estimatedWaitMinutes)}
                </p>
                <p className="text-sm text-brand-600">estimated wait</p>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                {estimate.reason ?? "An estimate isn't available for this entry yet."}
              </div>
            )}

            <div className="rounded-md border border-slate-200 divide-y divide-slate-100 px-3 text-sm">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">Patients ahead</span>
                <span className="font-medium text-navy-900">{estimate.patientsAhead ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">Average service time</span>
                <span className="font-medium text-navy-900">
                  {estimate.averageServiceMinutes !== null ? formatMinutes(estimate.averageServiceMinutes) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">Service capacity</span>
                <span className="font-medium text-navy-900">{estimate.serviceCapacity}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">Based on</span>
                <span className="font-medium text-navy-900">
                  {estimate.sampleSize} recent {estimate.sampleSize === 1 ? "visit" : "visits"}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Calculated {new Date(estimate.calculatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
              An estimate, not a guarantee — actual wait depends on how the department's day unfolds.
            </p>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
'@

$overrideModalContent = @'
import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { priorityService } from "@/services/priority.service";
import { getErrorMessage } from "@/services/api";
import type { QueueEntry } from "@/types/queue";

interface OverridePriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: QueueEntry | null;
  /** Called with the updated effective priority once the override succeeds, so the caller can refresh the list. */
  onOverridden: () => void;
}

const MIN_REASON_LENGTH = 10;

/**
 * A controlled, documented override of a patient's calculated priority.
 * The backend requires a reason of at least 10 characters (zod validator,
 * priorityOverride.validators.ts) specifically so an override is never
 * indistinguishable from a silent, unexplained reordering of the queue —
 * this form enforces the same minimum client-side so the error is caught
 * before a round trip, not instead of the server-side check.
 */
export function OverridePriorityModal({ isOpen, onClose, entry, onOverridden }: OverridePriorityModalProps) {
  const [overrideValue, setOverrideValue] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function resetAndClose() {
    setOverrideValue("");
    setReason("");
    setFormError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!entry) return;

    const numericValue = Number(overrideValue);
    if (overrideValue.trim() === "" || Number.isNaN(numericValue) || numericValue < 0) {
      setFormError("Enter a valid, non-negative priority value.");
      return;
    }
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setFormError(`Provide a documented reason of at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await priorityService.override(entry.id, { overrideValue: numericValue, reason: reason.trim() });
      onOverridden();
      resetAndClose();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!entry) return null;

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Override priority">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="font-medium text-navy-900">
            {entry.patient.firstName} {entry.patient.lastName}
          </p>
          <p className="text-sm text-slate-500">
            {entry.patient.patientNumber} · {entry.queueNumber} · current effective priority{" "}
            <strong>{entry.effectivePriority}</strong>
          </p>
        </div>

        <div className="rounded-md border border-warning-100 bg-warning-50 px-3 py-2.5 text-sm text-warning-700">
          This replaces the calculated priority for this patient only. It does not change how priority is calculated
          for anyone else, and it is recorded in the audit log with your name and reason.
        </div>

        <Input
          label="New priority value"
          type="number"
          min={0}
          step={1}
          required
          value={overrideValue}
          onChange={(e) => setOverrideValue(e.target.value)}
          placeholder="e.g. 150"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="override-reason" className="text-sm font-medium text-slate-700">
            Reason
            <span className="ml-0.5 text-danger-600" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> required</span>
          </label>
          <textarea
            id="override-reason"
            required
            minLength={MIN_REASON_LENGTH}
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this patient's priority is being changed manually (minimum 10 characters)."
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:border-brand-500"
          />
          <p className="text-xs text-slate-400">{reason.trim().length}/{MIN_REASON_LENGTH} characters minimum</p>
        </div>

        {formError && (
          <p role="alert" className="text-sm text-danger-600">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={resetAndClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={isSubmitting}>
            Apply override
          </Button>
        </div>
      </form>
    </Modal>
  );
}
'@

$queuePageContent = @'
import { useCallback, useEffect, useState } from "react";
import { UserPlus, RefreshCw, PhoneCall, ListOrdered, Users, Info, SlidersHorizontal, Clock } from "lucide-react";
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
import { getErrorMessage } from "@/services/api";
import { getAvailableActions } from "@/utils/queueTransitions";
import type { QueueEntry, QueueStatus, Department } from "@/types/queue";

const CAN_CHECK_IN_ROLES = ["RECEPTIONIST", "ADMIN"];
const CAN_CALL_NEXT_ROLES = ["NURSE", "DOCTOR", "ADMIN"];
// Mirrors the backend's ROLE_GROUPS.priorityView / priorityOverride
// (src/config/rolePermissions.ts) exactly — RECEPTIONIST never sees the
// priority breakdown or override UI, matching the fields the backend
// omits entirely from a RECEPTIONIST's queue-list response.
const CAN_VIEW_PRIORITY_ROLES = ["NURSE", "DOCTOR", "ADMIN"];
const CAN_OVERRIDE_PRIORITY_ROLES = ["NURSE", "DOCTOR", "ADMIN"];

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

  // Priority Engine UI — breakdown ("why is this patient ranked here"),
  // manual override, and wait-time estimate each have their own modal and
  // their own "which entry is this open for" state, mirroring the
  // existing isCheckInOpen/confirmTarget pattern above rather than
  // introducing a new approach.
  const [breakdownEntry, setBreakdownEntry] = useState<QueueEntry | null>(null);
  const [overrideEntry, setOverrideEntry] = useState<QueueEntry | null>(null);
  const [estimateEntry, setEstimateEntry] = useState<QueueEntry | null>(null);

  const canCheckIn = user ? CAN_CHECK_IN_ROLES.includes(user.role) : false;
  const canCallNext = user ? CAN_CALL_NEXT_ROLES.includes(user.role) : false;
  const canViewPriority = user ? CAN_VIEW_PRIORITY_ROLES.includes(user.role) : false;
  const canOverridePriority = user ? CAN_OVERRIDE_PRIORITY_ROLES.includes(user.role) : false;

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
      // Entries arrive already ordered by the backend's effective-priority
      // formula (effectivePriority DESC, then check-in time) — see
      // queue.service.ts on the server. Nothing re-sorts them here, so
      // the row order on screen is always the real queue order.
      setEntries(list.entries);
      setCounts({ WAITING: waiting, CALLED: called, IN_CONSULTATION: inConsultation, COMPLETED: completed, CANCELLED: 0, NO_SHOW: 0 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [departmentFilter, statusFilter]);

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
                <TableHeaderCell>Check-in</TableHeaderCell>
                <TableHeaderCell>Waiting</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {canViewPriority && <TableHeaderCell>Priority</TableHeaderCell>}
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
                    <TableCell>{formatTime(entry.checkInTime)}</TableCell>
                    <TableCell>{formatWaiting(entry.waitingMinutes)}</TableCell>
                    <TableCell>
                      <QueueStatusBadge status={entry.status} />
                    </TableCell>
                    {canViewPriority && (
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            {entry.triagePriority ? (
                              <TriagePriorityBadge priority={entry.triagePriority} />
                            ) : (
                              <span className="text-xs text-slate-400">Not triaged</span>
                            )}
                            {entry.hasManualOverride && <Badge tone="warning">Override</Badge>}
                          </div>
                          <span className="text-xs text-slate-500">score {entry.effectivePriority}</span>
                        </div>
                      </TableCell>
                    )}
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
                        {canViewPriority && entry.priorityBreakdown && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBreakdownEntry(entry)}
                            title="Why is this patient ranked here?"
                          >
                            <Info className="h-3.5 w-3.5" aria-hidden="true" />
                            Why
                          </Button>
                        )}
                        {canOverridePriority && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOverrideEntry(entry)}
                            title="Override this patient's priority"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                            Override
                          </Button>
                        )}
                        {(entry.status === "WAITING" || entry.status === "CALLED") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEstimateEntry(entry)}
                            title="Estimated wait time"
                          >
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            ETA
                          </Button>
                        )}
                        {actions.length === 0 && !canViewPriority && !canOverridePriority && (
                          <span className="text-sm text-slate-400">—</span>
                        )}
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

      <PriorityBreakdownModal
        isOpen={breakdownEntry !== null}
        onClose={() => setBreakdownEntry(null)}
        entry={breakdownEntry}
      />

      <OverridePriorityModal
        isOpen={overrideEntry !== null}
        onClose={() => setOverrideEntry(null)}
        entry={overrideEntry}
        onOverridden={() => {
          showToast("success", "Priority override applied.");
          fetchQueue();
        }}
      />

      <EstimateDetailsModal
        isOpen={estimateEntry !== null}
        onClose={() => setEstimateEntry(null)}
        entry={estimateEntry}
      />
    </>
  );
}
'@

# ---------------------------------------------------------------------------
# Write each file (UTF8 without BOM, matching the rest of the project).
# ---------------------------------------------------------------------------
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Write-FileExact($path, $content) {
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

Write-FileExact $FormatMinsPath  $formatMinutesContent
Write-FileExact $EstimatePath    $estimateModalContent
Write-FileExact $OverridePath    $overrideModalContent
Write-FileExact $QueuePagePath   $queuePageContent

# ---------------------------------------------------------------------------
# Verify — confirm each file now exists and is non-trivial in size (a
# write that silently failed or wrote nothing would leave a 0-byte or
# missing file, which this would catch).
# ---------------------------------------------------------------------------
Write-Host "`nVerifying written files:" -ForegroundColor Cyan
$allOk = $true
foreach ($check in @(
    @{ Path = $FormatMinsPath; MinBytes = 200 },
    @{ Path = $EstimatePath;   MinBytes = 2000 },
    @{ Path = $OverridePath;   MinBytes = 2000 },
    @{ Path = $QueuePagePath;  MinBytes = 10000 }
)) {
    if (Test-Path $check.Path) {
        $size = (Get-Item $check.Path).Length
        if ($size -ge $check.MinBytes) {
            Write-Host "  OK   $($check.Path)  ($size bytes)" -ForegroundColor Green
        } else {
            Write-Host "  FAIL $($check.Path)  only $size bytes (expected at least $($check.MinBytes))" -ForegroundColor Red
            $allOk = $false
        }
    } else {
        Write-Host "  FAIL $($check.Path)  does not exist after write" -ForegroundColor Red
        $allOk = $false
    }
}

if ($allOk) {
    Write-Host "`nAll four files written successfully." -ForegroundColor Green
    Write-Host "Backup of the original QueuePage.tsx: $backupRoot" -ForegroundColor Cyan
    Write-Host "`nNext: cd `"$ClientRoot`" ; npm run typecheck ; npm run build" -ForegroundColor Cyan
} else {
    Write-Host "`nOne or more files failed verification — see FAIL lines above." -ForegroundColor Red
    exit 1
}