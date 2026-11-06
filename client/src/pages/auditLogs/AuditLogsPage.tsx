import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, History, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AuditActionBadge } from "@/components/common/AuditActionBadge";
import { AuditLogDetailModal } from "./AuditLogDetailModal";
import { auditLogService } from "@/services/auditLog.service";
import { getErrorMessage } from "@/services/api";
import type { AuditLogEntry, AuditAction } from "@/types/auditLog";
import type { Pagination } from "@/types/patient";

const ACTIONS: AuditAction[] = [
  "CHECK_IN",
  "TRIAGE_RECORDED",
  "PRIORITY_RECALCULATED",
  "PRIORITY_OVERRIDE",
  "PATIENT_CALLED",
  "CONSULTATION_STARTED",
  "CONSULTATION_COMPLETED",
  "QUEUE_CANCELLED",
  "NO_SHOW_MARKED",
  "PRESCRIPTION_CREATED",
  "PRESCRIPTION_DISPENSED",
  "USER_LOGIN",
  "CONFIG_UPDATED",
];

const PAGE_SIZE = 25;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);

  const [actionFilter, setActionFilter] = useState<AuditAction | "">("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userIdFilter, setUserIdFilter] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<AuditLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Whole-day-inclusive convenience: the backend treats dateFrom/dateTo
      // as exact instant bounds (documented), so the date-picker values
      // are expanded to start-of-day / end-of-day here rather than
      // relying on the backend to guess what a bare date means.
      const result = await auditLogService.list({
        action: actionFilter || undefined,
        entityType: entityTypeFilter.trim() || undefined,
        userId: userIdFilter ?? undefined,
        dateFrom: dateFrom ? `${dateFrom}T00:00:00.000` : undefined,
        dateTo: dateTo ? `${dateTo}T23:59:59.999` : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, entityTypeFilter, dateFrom, dateTo, userIdFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleFilterSubmit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    fetchLogs();
  }

  function handleClearFilters() {
    setActionFilter("");
    setEntityTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setUserIdFilter(null);
    setPage(1);
  }

  const hasActiveFilters = actionFilter || entityTypeFilter || dateFrom || dateTo || userIdFilter;

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="A read-only record of important system mutations — who did what, to what, and when. This is an accountability trail, not a clinical record viewer."
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Audit Logs" }]}
        actions={
          <Button variant="secondary" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Action" value={actionFilter} onChange={(e) => setActionFilter(e.target.value as AuditAction | "")}>
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Input label="Entity type" placeholder="e.g. Prescription" value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)} />
          <Input label="From date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="To date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary" className="w-full">
              Apply filters
            </Button>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
          </div>
        </form>
        {userIdFilter && (
          <p className="mt-3 text-sm text-slate-500">
            Filtering by one user.{" "}
            <button type="button" onClick={() => setUserIdFilter(null)} className="font-medium text-brand-600 hover:underline">
              Clear
            </button>
          </p>
        )}
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading audit logs" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchLogs} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={History}
            title={hasActiveFilters ? "No audit entries match these filters" : "No audit entries yet"}
            description={hasActiveFilters ? "Try different filters or clear them." : "System mutations that are audited will appear here."}
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Date &amp; time</TableHeaderCell>
                  <TableHeaderCell>User</TableHeaderCell>
                  <TableHeaderCell>Action</TableHeaderCell>
                  <TableHeaderCell>Entity</TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sr-only">Details</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setUserIdFilter(entry.userId)}
                        className="text-left hover:underline"
                        title="Filter by this user"
                      >
                        {entry.user.firstName} {entry.user.lastName}
                      </button>
                    </TableCell>
                    <TableCell>
                      <AuditActionBadge action={entry.action} />
                    </TableCell>
                    <TableCell>
                      {entry.entityType} <span className="text-xs text-slate-400">{entry.entityId.slice(0, 8)}…</span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetailEntry(entry)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                <p className="text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} entr{pagination.total === 1 ? "y" : "ies"}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1}>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <AuditLogDetailModal isOpen={detailEntry !== null} onClose={() => setDetailEntry(null)} entry={detailEntry} />
    </>
  );
}
