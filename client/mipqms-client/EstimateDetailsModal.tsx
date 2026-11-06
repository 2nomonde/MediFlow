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
