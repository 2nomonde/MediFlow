import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, X, UserPlus, ChevronLeft, ChevronRight, Users, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { patientService } from "@/services/patient.service";
import { getErrorMessage } from "@/services/api";
import type { Patient, Pagination } from "@/types/patient";

const PAGE_SIZE = 20;

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNSPECIFIED: "Not specified",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function PatientsListPage() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async (targetPage: number, search: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await patientService.list({ page: targetPage, pageSize: PAGE_SIZE, search: search || undefined });
      setPatients(result.patients);
      setPagination(result.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients(page, activeSearch);
  }, [fetchPatients, page, activeSearch]);

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

  return (
    <>
      <PageHeader
        title="Patients"
        description="Search, register, and manage patient records."
        breadcrumbs={[{ label: "Dashboard", path: "/dashboard" }, { label: "Patients" }]}
        actions={
          <Link to="/patients/new">
            <Button>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Register patient
            </Button>
          </Link>
        }
      />

      <Card className="mb-4 p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Search patients"
              placeholder="Patient number, name, ID/passport, or phone"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
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
            {pagination ? `${pagination.total} patient${pagination.total === 1 ? "" : "s"}` : "Patients"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchPatients(page, activeSearch)}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            Refresh
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" label="Loading patients" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchPatients(page, activeSearch)} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={activeSearch ? "No patients match your search" : "No patients registered yet"}
            description={
              activeSearch
                ? "Try a different patient number, name, ID/passport number, or phone number."
                : "Register the first patient to get started."
            }
            action={
              !activeSearch && (
                <Link to="/patients/new">
                  <Button size="sm">Register patient</Button>
                </Link>
              )
            }
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Patient number</TableHeaderCell>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Date of birth</TableHeaderCell>
                  <TableHeaderCell>Gender</TableHeaderCell>
                  <TableHeaderCell>Phone</TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sr-only">Actions</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.patientNumber}</TableCell>
                    <TableCell>
                      {patient.firstName} {patient.lastName}
                    </TableCell>
                    <TableCell>{formatDate(patient.dateOfBirth)}</TableCell>
                    <TableCell>{GENDER_LABELS[patient.gender] ?? patient.gender}</TableCell>
                    <TableCell>{patient.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${patient.id}`)}>
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
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} patient
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
    </>
  );
}
