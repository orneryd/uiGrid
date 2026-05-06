import { FilterCondition, SortDirection } from './grid.constants';
import { nextUid } from './grid.utils';
import defaultLabels from './i18n/en-US.json';

export interface GridTemplateRefLike<Context = unknown> {
  createEmbeddedView?(context: Context): unknown;
}

export type GridRecord = Record<string, unknown>;

export type GridSortFn = (left: unknown, right: unknown) => number;

export type GridFilterPredicate = (
  term: unknown,
  value: unknown,
  row: GridRecord,
  column: GridColumnDef,
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

export interface GridHeaderTemplateContext {
  $implicit: string;
  value: string;
  column: GridColumnDef;
}

export interface GridCellEditableContext {
  row: GridRecord;
  column: GridColumnDef;
  rowIndex: number;
  triggerEvent?: Event | KeyboardEvent | null;
}

export interface GridCellPosition {
  rowId: string;
  columnName: string;
}

export type GridCellEditableCondition = boolean | ((context: GridCellEditableContext) => boolean);
export type GridColumnType = 'string' | 'number' | 'boolean' | 'date' | 'object';

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
  type?: GridColumnType;
  visible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableGrouping?: boolean;
  enableCellEdit?: boolean;
  enableCellEditOnFocus?: boolean;
  /** Pinning */
  pinnedLeft?: boolean;
  pinnedRight?: boolean;
  enablePinning?: boolean;
  cellEditableCondition?: GridCellEditableCondition;
  editModelField?: string;
  width?: string;
  align?: 'start' | 'center' | 'end';
  sort?: GridSortDescriptor;
  filter?: GridFilterDescriptor;
  sortingAlgorithm?: GridSortFn;
  valueGetter?: (row: GridRecord) => unknown;
  formatter?: (value: unknown, row: GridRecord) => string;
  headerRenderer?: (context: GridHeaderTemplateContext) => string;
  cellTemplate?: GridTemplateRefLike<GridCellTemplateContext>;
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
  pinning?: Record<string, 'left' | 'right'>;
}

export interface GridLabels {
  /** Sort button – unsorted state */
  sortDefault: string;
  /** Sort button – ascending */
  sortAsc: string;
  /** Sort button – descending */
  sortDesc: string;
  /** Group toggle – not grouped */
  groupColumn: string;
  /** Group toggle – grouped */
  ungroupColumn: string;
  /** Group row – collapse */
  groupCollapse: string;
  /** Group row – expand */
  groupExpand: string;
  /** Tree toggle – collapse */
  treeCollapse: string;
  /** Tree toggle – expand */
  treeExpand: string;
  /** Expand detail row */
  expandDetail: string;
  /** Collapse detail row */
  collapseDetail: string;
  /** Filter input placeholder */
  filterPlaceholder: string;
  /** Filter input placeholder when disabled */
  filterDisabled: string;
  /** Filter column sr-only prefix ("Filter" in "Filter {column}") */
  filterColumn: string;
  /** Pagination – previous page */
  paginationPrevious: string;
  /** Pagination – next page */
  paginationNext: string;
  /** Pagination – "Page" prefix in "Page X of Y" */
  paginationPage: string;
  /** Pagination – "of" in "Page X of Y" */
  paginationOf: string;
  /** Pagination – page size label */
  paginationRows: string;
  /** Empty state heading (fallback if emptyMessage not set) */
  emptyHeading: string;
  /** Empty state description */
  emptyDescription: string;
  /** Toolbar – "of" in "X of Y rows" */
  toolbarOf: string;
  /** Toolbar – "rows" */
  toolbarRows: string;
  /** Stats card – "visible rows" */
  statsVisibleRows: string;
  /** Group row – "rows" suffix */
  groupRowsSuffix: string;
  /** Pin trigger for choosing left or right */
  pinColumn: string;
  /** Pin left action */
  pinLeft: string;
  /** Pin right action */
  pinRight: string;
  /** Unpin action */
  unpin: string;
}

/**
 * Default English (en-US) labels loaded from `i18n/en-US.json`.
 * A future build step can swap in a different JSON file at compile time.
 * At runtime, consumers can pass `labels: Partial<GridLabels>` in GridOptions
 * to override individual keys — missing keys are backfilled from this default.
 */
export const DEFAULT_GRID_LABELS: Readonly<GridLabels> = defaultLabels;

export interface GridOptions {
  id: string;
  title?: string;
  data: readonly GridRecord[];
  columnDefs: readonly GridColumnDef[];
  labels?: Partial<GridLabels>;
  rowHeight?: number;
  headerRowHeight?: number;
  emptyMessage?: string;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableGrouping?: boolean;
  enableColumnMoving?: boolean;
  enableColumnResizing?: boolean;
  enableVirtualization?: boolean;
  enableCellEdit?: boolean;
  enableCellEditOnFocus?: boolean;
  cellEditableCondition?: GridCellEditableCondition;
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
  expandableRowTemplate?: GridTemplateRefLike<GridExpandableTemplateContext>;
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
  /** Enable column pinning (freeze left/right) */
  enablePinning?: boolean;
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
    readonly height = 44,
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
