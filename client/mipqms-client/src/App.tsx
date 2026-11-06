import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ToastViewport } from "@/components/ui/Toast";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RoleRoute } from "@/routes/RoleRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ComingSoon } from "@/components/common/ComingSoon";
import { NAV_ITEMS } from "@/config/navigation";
import { PatientsListPage } from "@/pages/patients/PatientsListPage";
import { PatientRegisterPage } from "@/pages/patients/PatientRegisterPage";
import { PatientProfilePage } from "@/pages/patients/PatientProfilePage";
import { PatientEditPage } from "@/pages/patients/PatientEditPage";
import { QueuePage } from "@/pages/queue/QueuePage";
import { TriagePage } from "@/pages/triage/TriagePage";
import { TriageFormPage } from "@/pages/triage/TriageFormPage";
import { AdministrationPage } from "@/pages/administration/AdministrationPage";
import { PriorityConfigPage } from "@/pages/administration/PriorityConfigPage";
import { ConsultationsPage } from "@/pages/consultations/ConsultationsPage";
import { ConsultationFormPage } from "@/pages/consultations/ConsultationFormPage";
import { PrescriptionsPage } from "@/pages/prescriptions/PrescriptionsPage";
import { AuditLogsPage } from "@/pages/auditLogs/AuditLogsPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { AppointmentsListPage } from "@/pages/appointments/AppointmentsListPage";

// Same roles the sidebar uses for each nav item — kept in sync via
// NAV_ITEMS rather than duplicated here.
const patientsNavItem = NAV_ITEMS.find((item) => item.path === "/patients")!;
const queueNavItem = NAV_ITEMS.find((item) => item.path === "/queue")!;
const triageNavItem = NAV_ITEMS.find((item) => item.path === "/triage")!;
const appointmentsNavItem = NAV_ITEMS.find((item) => item.path === "/appointments")!;
const consultationsNavItem = NAV_ITEMS.find((item) => item.path === "/consultations")!;
const prescriptionsNavItem = NAV_ITEMS.find((item) => item.path === "/prescriptions")!;
const auditLogsNavItem = NAV_ITEMS.find((item) => item.path === "/audit-logs")!;
const reportsNavItem = NAV_ITEMS.find((item) => item.path === "/reports")!;

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Patient Management (Phase 7/8) */}
              <Route element={<RoleRoute allowedRoles={patientsNavItem.roles} />}>
                <Route path="/patients" element={<PatientsListPage />} />
                <Route path="/patients/new" element={<PatientRegisterPage />} />
                <Route path="/patients/:id" element={<PatientProfilePage />} />
                <Route path="/patients/:id/edit" element={<PatientEditPage />} />
              </Route>

              {/* Queue Management (Phase 9) */}
              <Route element={<RoleRoute allowedRoles={queueNavItem.roles} />}>
                <Route path="/queue" element={<QueuePage />} />
              </Route>

              {/* Triage (Phase 10) — route param is a queueEntryId, not a
                  triage record id, so the form page can decide create vs
                  edit by trying to look one up. */}
              <Route element={<RoleRoute allowedRoles={triageNavItem.roles} />}>
                <Route path="/triage" element={<TriagePage />} />
                <Route path="/triage/:queueEntryId" element={<TriageFormPage />} />
              </Route>
              <Route element={<RoleRoute allowedRoles={appointmentsNavItem.roles} />}>
                <Route path="/appointments" element={<AppointmentsListPage />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
                <Route path="/administration/priority-config" element={<PriorityConfigPage />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={consultationsNavItem.roles} />}>
                <Route path="/consultations" element={<ConsultationsPage />} />
                <Route path="/consultations/:queueEntryId" element={<ConsultationFormPage />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={prescriptionsNavItem.roles} />}>
                <Route path="/prescriptions" element={<PrescriptionsPage />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={auditLogsNavItem.roles} />}>
                <Route path="/audit-logs" element={<AuditLogsPage />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={reportsNavItem.roles} />}>
                <Route path="/reports" element={<ReportsPage />} />
              </Route>

              {/* Every other non-dashboard nav item is still a role-gated
                  placeholder until its real module ships in a later phase.
                  Generated from the same NAV_ITEMS config the sidebar
                  reads, so the two can never drift out of sync. */}
              {NAV_ITEMS.filter(
                (item) => !["/dashboard", "/patients", "/queue", "/triage", "/administration", "/consultations", "/prescriptions","/audit-logs","/reports",].includes(item.path)
              ).map((item) => (
                <Route key={item.path} element={<RoleRoute allowedRoles={item.roles} />}>
                  <Route
                    path={item.path}
                    element={<ComingSoon title={item.label} description={item.description} />}
                  />
                </Route>
              ))}

              <Route element={<RoleRoute allowedRoles={["ADMIN"]} />}>
                <Route
                  path="/administration"
                  element={<AdministrationPage />}
                />
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>

        </Routes>

        <ToastViewport />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;