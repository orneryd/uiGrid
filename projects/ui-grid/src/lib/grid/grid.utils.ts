import { GridColumnDef, GridRecord } from './grid.models';

let uid = 0;

export function nextUid(prefix = 'grid'): string {
  uid += 1;
  return `${prefix}-${uid}`;
}

export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function getPathValue(record: GridRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, record);
}

export function setPathValue(record: GridRecord, path: string, value: unknown): void {
  const parts = path.split('.');
  const lastPart = parts.pop();
  if (!lastPart) {
    return;
  }

  let current: Record<string, unknown> = record;
  for (const part of parts) {
    const next = current[part];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      current[part] = {};
    }

    current = current[part] as Record<string, unknown>;
  }

  current[lastPart] = value;
}

export function titleize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function getCellValue(row: GridRecord, column: GridColumnDef): unknown {
  if (column.valueGetter) {
    return column.valueGetter(row);
  }

  if (column.field) {
    return getPathValue(row, column.field);
  }

  return row[column.name];
}

export function stringifyCellValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return value === null || value === undefined ? '' : String(value);
}

export function toCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
