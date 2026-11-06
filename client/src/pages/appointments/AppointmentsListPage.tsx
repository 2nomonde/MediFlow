import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarPlus, Search, X, ChevronLeft, ChevronRight, CalendarClock, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AppointmentStatusBadge } from "@/components/common/AppointmentStatusBadge";
import { NewAppointmentModal } from "./NewAppointmentModal";
import { RescheduleModal } from "./RescheduleModal";
import { AppointmentDetailsModal } from "./AppointmentDetailsModal";
import { CancelAppointmentModal } from "./CancelAppointmentModal";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { appointmentService } from "@/services/appointment.service";
import { getErrorMessage } from "@/services/api";
import type { Appointment, AppointmentStatus, Pagination } from "@/types/appointment";

const PAGE_SIZE = 20;

/** Terminal statuses — reschedule/cancel actions are hidden for these, matching the backend's own refusal rules. */
const LOCKED_STATUSES: AppointmentStatus[] = ["CANCELLED", "COMPLETED", "NO_SHOW"];

const STATUS_OPTIONS: { value: AppointmentStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No-show" },
  { value: "COMPLETED", label: "Completed" },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AppointmentsListPage() {
  const { showToast } = useToast();
  const { user } = useAuth();

  // RECEPTIONIST/ADMIN can create, reschedule and cancel. NURSE and
  // DOCTOR (added for this phase's refined brief) get a read-only view
  // of this same page — the mutating actions below simply don't render
  // for them. The real security boundary is still the backend RBAC
  // (appointment.routes.ts), this is UX only, same as every other page
  // in this project.
  const canManage = user?.role === "RECEPTIONIST" || user?.role === "ADMIN";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "">("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [detailsAppointment, setDetailsAppointment] = useState<Appointment | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);

  const fetchAppointments = useCallback(async (targetPage: number, search: string, status: AppointmentStatus | "") => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await appointmentService.list({
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
      });
      setAppointments(result.appointments);
      setPagination(result.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments(page, activeSearch, statusFilter);
  }, [fetchAppointments, page, activeSearch, statusFilter]);

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setActiveSearch(searchInput.trim());
  }

  function handleClearSearch() {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
  }

  function handleCreated(appointment: Appointment) {
    setIsNewOpen(false);
    showToast(
      "success",
      `Appointment scheduled for ${appointment.patient.firstName} ${appointment.patient.lastName} on ${formatDateTime(appointment.scheduledAt)}.`
    );
    fetchAppointments(page, activeSearch, statusFilter);
  }

  function handleRescheduled(appointment: Appointment) {
    setRescheduleAppointment(null);
    showToast("success", `Appointment rescheduled to ${formatDateTime(appointment.scheduledAt)}.`);
    fetchAppointments(page, activeSearch, statusFilter);
  }

  function handleCancelled() {
    setCancelTarget(null);
    showToast("success", "Appointment cancelled.");
    fetchAppointments(page, activeSearch, statusFilter);
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Schedule, reschedule, and cancel patient appointments by department and doctor."
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Appointments" }]}
        actions={
          canManage ? (
            <Button onClick={() => setIsNewOpen(true)}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Schedule appointment
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Search appointments"
              placeholder="Patient number, name"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as AppointmentStatus | "");
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
            {activeSearch && (
              <Button type="button" variant="ghost" onClick={handleClearSearch}>
                <X className="h-4 w-4" aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <p className="text-sm text-slate-500">
            {pagination ? `${pagination.total} appointment${pagination.total === 1 ? "" : "s"}` : "Appointments"}
          </p>
          <Button variant="ghost" size="sm" onClick={() => fetchAppointments(page, activeSearch, statusFilter)} disabled={isLoading}>
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading appointments" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchAppointments(page, activeSearch, statusFilter)} />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={activeSearch || statusFilter ? "No appointments match your filters" : "No appointments scheduled yet"}
            description={
              activeSearch || statusFilter
                ? "Try a different search term or status filter."
                : "Schedule the first appointment to get started."
            }
            action={
              canManage && !activeSearch && !statusFilter ? (
                <Button size="sm" onClick={() => setIsNewOpen(true)}>
                  Schedule appointment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Date &amp; time</TableHeaderCell>
                  <TableHeaderCell>Patient</TableHeaderCell>
                  <TableHeaderCell>Department</TableHeaderCell>
                  <TableHeaderCell>Doctor</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sr-only">Actions</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {appointments.map((appointment) => {
                  const isLocked = LOCKED_STATUSES.includes(appointment.status);
                  return (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">{formatDateTime(appointment.scheduledAt)}</TableCell>
                      <TableCell>
                        {appointment.patient.firstName} {appointment.patient.lastName}
                        <span className="ml-1.5 text-xs text-slate-400">{appointment.patient.patientNumber}</span>
                      </TableCell>
                      <TableCell>{appointment.department.name}</TableCell>
                      <TableCell>
                        Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                      </TableCell>
                      <TableCell>
                        <AppointmentStatusBadge status={appointment.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => setDetailsAppointment(appointment)}>
                            View
                          </Button>
                          {canManage && !isLocked && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => setRescheduleAppointment(appointment)}>
                                Reschedule
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setCancelTarget(appointment)}>
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                <p className="text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages} &middot; {pagination.total} appointment
                  {pagination.total === 1 ? "" : "s"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                  >
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

      <NewAppointmentModal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} onCreated={handleCreated} />
      <AppointmentDetailsModal appointment={detailsAppointment} onClose={() => setDetailsAppointment(null)} />
      <RescheduleModal
        appointment={rescheduleAppointment}
        onClose={() => setRescheduleAppointment(null)}
        onRescheduled={handleRescheduled}
      />
      <CancelAppointmentModal
        appointment={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={handleCancelled}
      />
    </>
  );
}
