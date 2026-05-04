import { GridColumnDef, GridHeaderTemplateContext, GridRow } from './grid.models';
import { titleize, toCsvValue } from './grid.utils';
import { buildGridCellContext, formatGridCellDisplayValue } from './grid.core.display';

export function headerLabel(column: GridColumnDef): string {
  return column.displayName ?? titleize(column.name);
}

export function buildGridHeaderContext(column: GridColumnDef): GridHeaderTemplateContext {
  const value = headerLabel(column);
  return {
    $implicit: value,
    value,
    column,
  };
}

export function formatGridHeaderDisplayValue(context: GridHeaderTemplateContext): string {
  return context.column.headerRenderer ? context.column.headerRenderer(context) : context.value;
}

export function exportCsvRows(
  columns: readonly GridColumnDef[],
  rows: readonly GridRow[],
  formatCell?: (row: GridRow, column: GridColumnDef) => string
): string {
  const header = columns.map((column) => toCsvValue(headerLabel(column))).join(',');
  const body = rows.map((row) => columns.map((column) => toCsvValue(
    formatCell
      ? formatCell(row, column)
      : formatGridCellDisplayValue(buildGridCellContext(row, column))
  )).join(','));
  return [header, ...body].join('\n');
}