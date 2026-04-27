import { TemplateRef } from '@angular/core';
import { FilterCondition, SortDirection } from './grid.constants';
import { nextUid } from './grid.utils';

export type GridRecord = Record<string, unknown>;

export type GridSortFn = (left: unknown, right: unknown) => number;

export type GridFilterPredicate = (
  term: unknown,
  value: unknown,
  row: GridRecord,
  column: GridColumnDef
) => boolean;

export type GridFilterOperator = FilterCondition | RegExp | GridFilterPredicate;

export interface GridFilterFlags {
  caseSensitive?: boolean;
  date?: boolean;
}

export interface GridFilterDescriptor {
  term?: unknown;
  condition?: GridFilterOperator;
  flags?: GridFilterFlags;
  rawTerm?: boolean;
  noTerm?: boolean;
}

export interface GridCellTemplateContext {
  $implicit: unknown;
  value: unknown;
  row: GridRecord;
  column: GridColumnDef;
  rowIndex: number;
}

export interface GridExpandableTemplateContext {
  $implicit: GridRecord;
  row: GridRecord;
  rowIndex: number;
  expanded: boolean;
}

export interface GridSortDescriptor {
  direction?: SortDirection;
  priority?: number;
  ignoreSort?: boolean;
}

export interface GridColumnDef {
  name: string;
  displayName?: string;
  field?: string;
  visible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableGrouping?: boolean;
  width?: string;
  align?: 'start' | 'center' | 'end';
  sort?: GridSortDescriptor;
  filter?: GridFilterDescriptor;
  sortingAlgorithm?: GridSortFn;
  valueGetter?: (row: GridRecord) => unknown;
  formatter?: (value: unknown, row: GridRecord) => string;
  cellTemplate?: TemplateRef<GridCellTemplateContext>;
  cellRenderer?: (context: GridCellTemplateContext) => string;
}

export interface GridGroupingOptions {
  groupBy?: string[];
  startCollapsed?: boolean;
}

export interface GridBenchmarkOptions {
  iterations?: number;
}

export interface GridSavedState {
  columnOrder?: string[];
  filters?: Record<string, string>;
  sort?: SortState;
  grouping?: string[];
  pagination?: {
    paginationCurrentPage: number;
    paginationPageSize: number;
  };
  expandable?: Record<string, boolean>;
  treeView?: Record<string, boolean>;
}

export interface GridOptions {
  id: string;
  title?: string;
  data: readonly GridRecord[];
  columnDefs: readonly GridColumnDef[];
  rowHeight?: number;
  headerRowHeight?: number;
  emptyMessage?: string;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableGrouping?: boolean;
  enableColumnMoving?: boolean;
  enableVirtualization?: boolean;
  enablePagination?: boolean;
  enablePaginationControls?: boolean;
  useExternalPagination?: boolean;
  paginationPageSizes?: number[] | null;
  paginationPageSize?: number;
  paginationCurrentPage?: number;
  totalItems?: number;
  enableExpandable?: boolean;
  expandableRowHeight?: number;
  expandableRowHeaderWidth?: number;
  expandableRowTemplate?: TemplateRef<GridExpandableTemplateContext>;
  expandableRowScope?: Record<string, unknown>;
  enableTreeView?: boolean;
  treeChildrenField?: string;
  treeIndent?: number;
  showTreeExpandNoChildren?: boolean;
  treeRowHeaderAlwaysVisible?: boolean;
  enableAutoResize?: boolean;
  infiniteScrollRowsFromEnd?: number;
  infiniteScrollUp?: boolean;
  infiniteScrollDown?: boolean;
  virtualizationThreshold?: number;
  viewportHeight?: number;
  grouping?: GridGroupingOptions;
  benchmark?: GridBenchmarkOptions;
  onRegisterApi?: (gridApi: unknown) => void;
  rowIdentity?: (row: GridRecord, index: number) => string;
}

export interface SortState {
  columnName: string | null;
  direction: SortDirection;
}

export interface GridBenchmarkResult {
  iterations: number;
  totalMs: number;
  averageMs: number;
  visibleRows: number;
  renderedItems: number;
}

export class GridRow {
  readonly uid = nextUid('row');
  readonly invisibleReasons = new Set<string>();
  visible = true;
  isSelected = false;
  treeLevel = 0;
  parentId: string | null = null;
  hasChildren = false;
  childCount = 0;
  expanded = false;
  expandedRowHeight = 0;

  constructor(
    readonly id: string,
    readonly entity: GridRecord,
    readonly index: number,
    readonly height = 44
  ) {}

  setThisRowInvisible(reason: string): void {
    this.invisibleReasons.add(reason);
    this.visible = false;
  }

  clearThisRowInvisible(reason: string): void {
    this.invisibleReasons.delete(reason);
    this.visible = this.invisibleReasons.size === 0;
  }
}
