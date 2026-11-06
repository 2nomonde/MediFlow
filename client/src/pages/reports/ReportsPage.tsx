import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Users, ListOrdered, Stethoscope, Pill, Clock, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { reportService } from "@/services/report.service";
import { getErrorMessage } from "@/services/api";
import type { ReportSummary } from "@/types/report";

type Preset = "today" | "7days" | "30days" | "custom";

function toDateInputValue(date: Date): string {
  // Local Y/M/D components, deliberately not toISOString() (which is
  // UTC-based and could land on the wrong calendar day near midnight in
  // some timezones) — matches the backend's own local-date convention.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function presetRange(preset: Exclude<Preset, "custom">): { from: string; to: string } {
  const today = new Date();
  const to = toDateInputValue(today);
  if (preset === "today") return { from: to, to };
  const daysBack = preset === "7days" ? 6 : 29;
  const from = new Date(today);
  from.setDate(from.getDate() - daysBack);
  return { from: toDateInputValue(from), to };
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "Insufficient completed records.";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("today");
  const [dateFrom, setDateFrom] = useState(() => presetRange("today").from);
  const [dateTo, setDateTo] = useState(() => presetRange("today").to);

  const [report, setReport] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReport(await reportService.getSummary({ dateFrom, dateTo }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function applyPreset(next: Exclude<Preset, "custom">) {
    setPreset(next);
    const range = presetRange(next);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  const hasNoData = report && report.summary.queueEntries === 0 && report.summary.patientsRegistered === 0;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Operational summaries for the selected date range — real system data, never predictions or estimates."
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Reports" }]}
        actions={
          <Button variant="secondary" onClick={fetchReport} disabled={isLoading}>
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            {(["today", "7days", "30days"] as const).map((p) => (
              <Button key={p} size="sm" variant={preset === p ? "primary" : "secondary"} onClick={() => applyPreset(p)}>
                {p === "today" ? "Today" : p === "7days" ? "Last 7 days" : "Last 30 days"}
              </Button>
            ))}
            <Button size="sm" variant={preset === "custom" ? "primary" : "secondary"} onClick={() => setPreset("custom")}>
              Custom
            </Button>
          </div>

          {preset === "custom" && (
            <>
              <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo} />
              <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom} />
              <Button size="sm" onClick={fetchReport}>
                Apply
              </Button>
            </>
          )}

          <p className="ml-auto text-sm text-slate-500">
            Showing {dateFrom} to {dateTo}
          </p>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <LoadingSpinner size="lg" label="Loading report" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReport} />
      ) : !report ? null : hasNoData ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <p className="font-medium text-navy-900">No reporting data for the selected period.</p>
          <p className="text-sm text-slate-500">Try a wider date range.</p>
        </Card>
      ) : (
        <>
          <section aria-labelledby="report-summary-heading" className="mb-8">
            <h2 id="report-summary-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Summary
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Patients registered" value={report.summary.patientsRegistered} icon={Users} tone="brand" />
              <StatCard label="Queue entries" value={report.summary.queueEntries} icon={ListOrdered} tone="brand" />
              <StatCard label="Completed" value={report.summary.completedQueueEntries} icon={ListOrdered} tone="success" />
              <StatCard label="Consultations completed" value={report.summary.consultationsCompleted} icon={Stethoscope} tone="brand" />
              <StatCard label="Prescriptions created" value={report.summary.prescriptionsCreated} icon={Pill} tone="brand" />
              <StatCard label="Prescriptions dispensed" value={report.summary.prescriptionsDispensed} icon={Pill} tone="success" />
            </div>
          </section>

          <section aria-labelledby="queue-performance-heading" className="mb-8">
            <h2 id="queue-performance-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Queue performance
            </h2>
            <Card>
              <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div>
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-lg font-semibold text-navy-900">{report.queue.total}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Completed</p>
                  <p className="text-lg font-semibold text-navy-900">{report.queue.completed}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Cancelled</p>
                  <p className="text-lg font-semibold text-navy-900">{report.queue.cancelled}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">No-show</p>
                  <p className="text-lg font-semibold text-navy-900">{report.queue.noShow}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Emergency</p>
                  <p className="text-lg font-semibold text-navy-900">{report.queue.emergency}</p>
                </div>
              </CardBody>
              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 px-5 py-4 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-slate-400">
                      Average actual waiting time <span className="italic">(historical, not the Phase 12 estimate)</span>
                    </p>
                    <p className="text-sm font-medium text-navy-900">{formatMinutes(report.waitingAndService.avgWaitingMinutes)}</p>
                    {report.waitingAndService.waitingSampleSize > 0 && (
                      <p className="text-xs text-slate-400">Based on {report.waitingAndService.waitingSampleSize} completed visits.</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Stethoscope className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <div>
                    <p className="text-xs text-slate-400">Average consultation duration</p>
                    <p className="text-sm font-medium text-navy-900">{formatMinutes(report.waitingAndService.avgServiceMinutes)}</p>
                    {report.waitingAndService.serviceSampleSize > 0 && (
                      <p className="text-xs text-slate-400">Based on {report.waitingAndService.serviceSampleSize} completed visits.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section aria-labelledby="prescription-activity-heading" className="mb-8">
            <h2 id="prescription-activity-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Prescription activity
            </h2>
            <Card>
              <CardBody className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Created</p>
                  <p className="text-lg font-semibold text-navy-900">{report.prescriptions.created}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Dispensed</p>
                  <p className="text-lg font-semibold text-navy-900">{report.prescriptions.dispensed}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Currently pending</p>
                  <p className="text-lg font-semibold text-navy-900">{report.prescriptions.pending}</p>
                  <p className="text-xs text-slate-400">Not scoped to the date range — a live snapshot.</p>
                </div>
              </CardBody>
            </Card>
          </section>

          <section aria-labelledby="department-summary-heading">
            <h2 id="department-summary-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Department summary
            </h2>
            <Card>
              {report.departments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <AlertTriangle className="h-6 w-6 text-slate-300" aria-hidden="true" />
                  <p className="text-sm text-slate-500">No departments configured yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Department</TableHeaderCell>
                      <TableHeaderCell>Queue entries</TableHeaderCell>
                      <TableHeaderCell>Completed</TableHeaderCell>
                      <TableHeaderCell>Avg. waiting</TableHeaderCell>
                      <TableHeaderCell>Avg. service</TableHeaderCell>
                      <TableHeaderCell>Consultations completed</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.departments.map((dept) => (
                      <TableRow key={dept.departmentId}>
                        <TableCell className="font-medium">{dept.departmentName}</TableCell>
                        <TableCell>{dept.queueEntries}</TableCell>
                        <TableCell>{dept.completedQueueEntries}</TableCell>
                        <TableCell>{formatMinutes(dept.avgWaitingMinutes)}</TableCell>
                        <TableCell>{formatMinutes(dept.avgServiceMinutes)}</TableCell>
                        <TableCell>{dept.consultationsCompleted}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </section>
        </>
      )}
    </>
  );
}
