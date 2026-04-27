import { Component, computed, input, signal } from '@angular/core';
import { FILTER_CONDITIONS, SORT_DIRECTIONS, SortDirection } from './grid.constants';
import { GridColumnDef, GridOptions, GridRecord, GridRow, SortState } from './grid.models';
import { getSortFn } from './row-sorter';
import { runColumnFilter, setupFilters } from './row-searcher';
import { getCellValue, stringifyCellValue, titleize, toCsvValue } from './grid.utils';

@Component({
  selector: 'app-ui-grid',
  templateUrl: './ui-grid.component.html',
  styleUrl: './ui-grid.component.scss'
})
export class UiGridComponent {
  readonly options = input.required<GridOptions>();

  protected readonly activeFilters = signal<Record<string, string>>({});
  protected readonly sortState = signal<SortState>({
    columnName: null,
    direction: SORT_DIRECTIONS.none
  });

  protected readonly visibleColumns = computed(() =>
    this.options().columnDefs.filter((column) => column.visible !== false)
  );

  protected readonly processedRows = computed(() => {
    const options = this.options();
    const rows = options.data.map((entity, index) => new GridRow(entity as GridRecord, index, options.rowHeight ?? 44));
    const columns = this.visibleColumns();
    const filters = this.activeFilters();

    const filteredRows = rows.filter((row) => {
      for (const column of columns) {
        const term = filters[column.name]?.trim();
        if (!term) {
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
    });

    const sortState = this.sortState();
    if (!sortState.columnName || sortState.direction === SORT_DIRECTIONS.none) {
      return filteredRows;
    }

    const sortColumn = columns.find((column) => column.name === sortState.columnName);
    if (!sortColumn) {
      return filteredRows;
    }

    const sortFn = getSortFn(sortColumn, filteredRows.map((row) => row.entity));
    const directionMultiplier = sortState.direction === SORT_DIRECTIONS.desc ? -1 : 1;

    return [...filteredRows].sort((left, right) => {
      const leftValue = getCellValue(left.entity, sortColumn);
      const rightValue = getCellValue(right.entity, sortColumn);
      return sortFn(leftValue, rightValue) * directionMultiplier;
    });
  });

  protected readonly totalRows = computed(() => this.options().data.length);
  protected readonly visibleRowCount = computed(() => this.processedRows().length);

  protected headerLabel(column: GridColumnDef): string {
    return column.displayName ?? titleize(column.name);
  }

  protected displayValue(row: GridRecord, column: GridColumnDef): string {
    const value = getCellValue(row, column);
    return column.formatter ? column.formatter(value, row) : stringifyCellValue(value);
  }

  protected sortDirection(column: GridColumnDef): SortDirection {
    const sortState = this.sortState();
    return sortState.columnName === column.name ? sortState.direction : SORT_DIRECTIONS.none;
  }

  protected toggleSort(column: GridColumnDef): void {
    if (column.sortable === false) {
      return;
    }

    const currentDirection = this.sortDirection(column);
    const nextDirection =
      currentDirection === SORT_DIRECTIONS.none
        ? SORT_DIRECTIONS.asc
        : currentDirection === SORT_DIRECTIONS.asc
          ? SORT_DIRECTIONS.desc
          : SORT_DIRECTIONS.none;

    this.sortState.set({
      columnName: nextDirection === SORT_DIRECTIONS.none ? null : column.name,
      direction: nextDirection
    });
  }

  protected updateFilter(columnName: string, value: string): void {
    this.activeFilters.update((current) => ({
      ...current,
      [columnName]: value
    }));
  }

  protected columnWidth(column: GridColumnDef): string {
    return column.width ?? 'minmax(11rem, 1fr)';
  }

  protected exportCsv(): void {
    const columns = this.visibleColumns();
    const header = columns.map((column) => toCsvValue(this.headerLabel(column))).join(',');
    const rows = this.processedRows().map((row) =>
      columns
        .map((column) => toCsvValue(this.displayValue(row.entity, column)))
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.options().id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
