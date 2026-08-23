const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function sanitizeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.length > 0 && FORMULA_PREFIXES.includes(str[0])) {
    return `'${str}`;
  }
  return str;
}

export function sanitizeCsvRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      sanitized[key] = sanitizeCsvCell(row[key]);
    }
    return sanitized as T;
  });
}
