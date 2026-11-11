const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] as const;

export const formatBytes = (value: number | string): string => {
  let amount = Number(value) || 0;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? amount : amount.toFixed(amount < 10 ? 1 : 0)} ${units[unit]}`;
};
