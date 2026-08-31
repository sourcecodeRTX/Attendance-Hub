export function getLocalDateString(date: Date = new Date()): string {
  const dObj = isNaN(date.getTime()) ? new Date() : date;
  const y = dObj.getFullYear();
  const m = String(dObj.getMonth() + 1).padStart(2, '0');
  const d = String(dObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
