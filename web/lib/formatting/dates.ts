/** An ISO timestamp → local date and time. */
export const formatTime = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const units: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** An ISO timestamp → "3 hours ago", as of when the page was rendered. */
export const formatRelative = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  if (Number.isNaN(seconds)) {
    return value;
  }
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return relative.format(Math.round(seconds / size), unit);
    }
  }
  return value;
};

/** Seconds between two timestamps, as "1m 20s"; empty if either is missing. */
export const formatDuration = (from: string | null | undefined, to: string | null | undefined): string => {
  if (!from || !to) {
    return "";
  }
  const total = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : "", `${seconds}s`].filter(Boolean).join(" ");
};
