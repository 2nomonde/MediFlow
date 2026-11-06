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
