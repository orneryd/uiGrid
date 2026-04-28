import { SORT_DIRECTIONS, SortDirection } from './grid.constants';
import { GridOptions, GridRecord, GridRow, SortState } from './grid.models';

export function resolveGridRowId(options: GridOptions, row: GridRow | GridRecord | string): string {
  if (typeof row === 'string') {
    return row;
  }

  if (row instanceof GridRow) {
    return row.id;
  }

  const rowIndex = options.data.indexOf(row);
  return options.rowIdentity?.(row, rowIndex) ?? `${options.id}-${rowIndex}`;
}

export function findGridRowById(rows: readonly GridRow[], rowId: string): GridRow | null {
  return rows.find((candidate) => candidate.id === rowId) ?? null;
}

export function buildGridSortState(columnName: string, direction?: SortDirection): SortState {
  return {
    columnName,
    direction: direction ?? SORT_DIRECTIONS.asc
  };
}