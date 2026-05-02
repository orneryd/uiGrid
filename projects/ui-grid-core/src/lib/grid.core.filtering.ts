import { FILTER_CONDITIONS } from './grid.constants';
import { GridColumnDef, GridOptions, GridRow } from './grid.models';
import { runColumnFilter, setupFilters } from './row-searcher';

function isFilteringEnabled(options: GridOptions): boolean {
  return options.enableFiltering !== false;
}

export function clearGridFilterReasons(row: GridRow): void {
  for (const reason of [...row.invisibleReasons]) {
    if (reason.startsWith('filter:')) {
      row.clearThisRowInvisible(reason);
    }
  }
}

export function matchesGridRowFilters(
  row: GridRow,
  columns: readonly GridColumnDef[],
  options: GridOptions,
  activeFilters: Readonly<Record<string, string>>
): boolean {
  if (!isFilteringEnabled(options)) {
    return row.visible;
  }

  for (const column of columns) {
    const term = activeFilters[column.name]?.trim();
    if (!term || column.filterable === false || column.enableFiltering === false) {
      row.clearThisRowInvisible(`filter:${column.name}`);
      continue;
    }

    const parsedFilters = setupFilters([
      {
        ...(column.filter ?? { condition: FILTER_CONDITIONS.contains }),
        term
      }
    ]);

    const matchesAll = parsedFilters.every((filter) => runColumnFilter(row.entity, column, filter));
    if (!matchesAll) {
      row.setThisRowInvisible(`filter:${column.name}`);
      return false;
    }

    row.clearThisRowInvisible(`filter:${column.name}`);
  }

  return row.visible;
}