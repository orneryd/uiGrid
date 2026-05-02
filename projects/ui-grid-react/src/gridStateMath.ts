import type { GridColumnDef } from '@ornery/ui-grid-core';
import { gridColumnWidth } from '@ornery/ui-grid-core';

export function orderVisibleColumns(
  columns: readonly GridColumnDef[],
  order: readonly string[],
): GridColumnDef[] {
  return [...columns]
    .filter((column) => column.visible !== false)
    .sort((left, right) => order.indexOf(left.name) - order.indexOf(right.name));
}

export function buildGridTemplateColumns(columns: readonly GridColumnDef[]): string {
  return columns.map((column) => gridColumnWidth(column)).join(' ');
}

export function resolveBenchmarkIterations(
  iterations?: number,
  configuredIterations?: number,
): number {
  return Math.max(1, iterations ?? configuredIterations ?? 25);
}

export function formatPaginationSummary(
  totalItems: number,
  firstRowIndex: number,
  lastRowIndex: number,
): string {
  if (totalItems === 0) {
    return '0-0 of 0';
  }

  return `${firstRowIndex + 1}-${lastRowIndex + 1} of ${totalItems}`;
}

export function computeViewportHeightPx(
  viewportHeight?: number,
  autoViewportHeight?: number | null,
): string {
  return `${viewportHeight ?? autoViewportHeight ?? 560}px`;
}

export function computeViewportRows(viewportHeight?: number, rowHeight?: number): number {
  return Math.max(1, Math.ceil((viewportHeight ?? 560) / (rowHeight ?? 44)));
}
