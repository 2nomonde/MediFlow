export interface DepartmentReportSummary {
  departmentId: string;
  departmentName: string;
  queueEntries: number;
  completedQueueEntries: number;
  avgWaitingMinutes: number | null;
  avgServiceMinutes: number | null;
  consultationsCompleted: number;
}

/** Mirrors the backend's GET /api/reports/summary response exactly. */
export interface ReportSummary {
  dateRange: { from: string; to: string; rangeEndExclusive: string };
  summary: {
    patientsRegistered: number;
    queueEntries: number;
    completedQueueEntries: number;
    consultationsCompleted: number;
    prescriptionsCreated: number;
    prescriptionsDispensed: number;
  };
  queue: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    emergency: number;
  };
  /** Real historical durations from timestamps — never the Phase 12 predictive estimate. */
  waitingAndService: {
    avgWaitingMinutes: number | null;
    waitingSampleSize: number;
    avgServiceMinutes: number | null;
    serviceSampleSize: number;
  };
  consultations: { started: number; completed: number };
  prescriptions: { created: number; dispensed: number; pending: number };
  departments: DepartmentReportSummary[];
}
