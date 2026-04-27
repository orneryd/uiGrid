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

export interface GridColumnDef {
  name: string;
  displayName?: string;
  field?: string;
  visible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: 'start' | 'center' | 'end';
  sort?: SortDirection;
  filter?: GridFilterDescriptor;
  sortingAlgorithm?: GridSortFn;
  valueGetter?: (row: GridRecord) => unknown;
  formatter?: (value: unknown, row: GridRecord) => string;
}

export interface GridOptions {
  id: string;
  title?: string;
  data: readonly GridRecord[];
  columnDefs: readonly GridColumnDef[];
  rowHeight?: number;
  headerRowHeight?: number;
  emptyMessage?: string;
}

export interface SortState {
  columnName: string | null;
  direction: SortDirection;
}

export class GridRow {
  readonly uid = nextUid('row');
  readonly invisibleReasons = new Set<string>();
  visible = true;
  isSelected = false;

  constructor(
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
