import { useEffect, useState } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { waitEstimateService } from "@/services/waitEstimate.service";
import { getErrorMessage } from "@/services/api";
import { formatMinutes } from "@/utils/formatMinutes";
import type { WaitEstimate } from "@/types/waitEstimate";

interface EstimateDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  queueEntryId: string | null;
  patientLabel: string;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-navy-900">{value}</span>
    </div>
  );
}

/**
 * "How this estimate was calculated" — every number shown here is
 * exactly what the backend computed, nothing rounded or embellished
 * further for effect. When `estimateAvailable` is false, the reason is
 * shown plainly instead of a number — never a fallback guess.
 */
export function EstimateDetailsModal({ isOpen, onClose, queueEntryId, patientLabel }: EstimateDetailsModalProps) {
  const [estimate, setEstimate] = useState<WaitEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!queueEntryId) return;
    setIsLoading(true);
    setError(null);
    try {
      setEstimate(await waitEstimateService.getEstimate(queueEntryId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen && queueEntryId) {
      load();
    } else {
      setEstimate(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, queueEntryId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="How this estimate was calculated">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-medium text-navy-900">{patientLabel}</p>
          <Button variant="ghost" size="sm" onClick={load} isLoading={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Recalculate
          </Button>
        </div>

        {isLoading && !estimate ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner label="Calculating estimate" />
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-danger-600">
            {error}
          </p>
        ) : estimate ? (
          estimate.estimateAvailable ? (
            <>
              <div className="rounded-md border border-slate-200 divide-y divide-slate-100 px-3">
                <Row label="Patients ahead" value={String(estimate.patientsAhead)} />
                <Row
                  label="Average service time"
                  value={estimate.averageServiceMinutes !== null ? formatMinutes(estimate.averageServiceMinutes) : "—"}
                />
                <Row label="Available service streams" value={String(estimate.serviceCapacity)} />
                <div className="flex items-center justify-between py-2 text-sm font-semibold text-navy-900">
                  <span>Estimated wait</span>
                  <span>~{formatMinutes(estimate.estimatedWaitMinutes ?? 0)}</span>
                </div>
              </div>
              {estimate.sampleSize > 0 && (
                <p className="text-xs text-slate-400">Based on the last {estimate.sampleSize} completed visits in this department.</p>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <p className="font-medium text-navy-900">Waiting-time estimate unavailable</p>
                <p className="text-slate-500">{estimate.reason ?? "Not enough information to calculate an estimate."}</p>
              </div>
            </div>
          )
        ) : null}

        <p className="text-xs text-slate-400">
          This is an operational estimate based on current queue conditions and recent service times. Actual waiting
          time may vary.
        </p>
      </div>
    </Modal>
  );
}
