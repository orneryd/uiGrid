import {
  GRID_CORE_CSS,
  SORT_DIRECTIONS,
  buildGridHeaderContext,
  canGridMoveColumns,
  downloadGridCsvFile,
  exportCsvRows,
  formatGridHeaderDisplayValue,
  getCellValue,
  sanitizeDownloadFilename,
  type DisplayItem,
  type GridColumnDef,
  type GridOptions,
  type GridRecord,
  type GroupItem,
  type GridRow,
} from '@ornery/ui-grid-core';
import {
  createVanillaGridController,
  type GridControllerSnapshot,
  type GridSaveState,
  type VanillaGridController,
} from './grid-controller';

function escapeHtml(value: unknown): string {
  const text = String(value ?? '');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function asGroupItem(item: DisplayItem): GroupItem {
  return item as GroupItem;
}

function isRowItem(item: DisplayItem): item is DisplayItem & { kind: 'row'; row: GridRow } {
  return item.kind === 'row';
}

export type VanillaUiGridElement = HTMLElement & {
  options: GridOptions;
  getState(): GridSaveState | null;
  setState(state: Partial<GridSaveState>): void;
  /**
   * Fast-path data update: patches only visible cell content in the existing
   * shadow DOM. Does NOT rebuild the scroll container or header, so scrolling
   * remains completely smooth while data ticks in the background.
   */
  setData(rows: GridRecord[]): void;
};

export type UiGridControlIconKey =
  | 'sortNone'
  | 'sortAsc'
  | 'sortDesc'
  | 'group'
  | 'groupExpanded'
  | 'groupCollapsed'
  | 'treeExpanded'
  | 'treeCollapsed'
  | 'expandExpanded'
  | 'expandCollapsed'
  | 'pin'
  | 'pinLeft'
  | 'pinRight'
  | 'paginationPrev'
  | 'paginationNext';

export interface UiGridIconDefinition {
  viewBox?: string;
  path: string;
}

export type UiGridIconOverrides = Partial<Record<UiGridControlIconKey, UiGridIconDefinition>>;

type VanillaGridOptions = GridOptions & {
  iconOverrides?: UiGridIconOverrides;
};

const DEFAULT_ICONS: Record<UiGridControlIconKey, UiGridIconDefinition> = {
  sortNone: { path: 'M7 6h10v2H7V6Zm0 5h7v2H7v-2Zm0 5h4v2H7v-2Z' },
  sortAsc: { path: 'M12 5l-6 6h4v8h4v-8h4z' },
  sortDesc: { path: 'M12 19l6-6h-4V5h-4v8H6z' },
  group: { path: 'M4 6h8v4H4V6Zm0 8h8v4H4v-4Zm10-8h6v4h-6V6Zm0 8h6v4h-6v-4Z' },
  groupExpanded: { path: 'M7 10l5 5 5-5z' },
  groupCollapsed: { path: 'M10 7l5 5-5 5z' },
  treeExpanded: { path: 'M7 10l5 5 5-5z' },
  treeCollapsed: { path: 'M10 7l5 5-5 5z' },
  expandExpanded: { path: 'M7 10l5 5 5-5z' },
  expandCollapsed: { path: 'M10 7l5 5-5 5z' },
  pin: { path: 'M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z' },
  pinLeft: { path: 'M10 6 4 12l6 6v-4h10v-4H10V6z' },
  pinRight: { path: 'M14 6v4H4v4h10v4l6-6-6-6z' },
  paginationPrev: { path: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z' },
  paginationNext: { path: 'M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z' },
};

export class UiGridStandaloneElement extends HTMLElement {
  private controller: VanillaGridController | null = null;
  private snapshot: GridControllerSnapshot | null = null;
  private unsubscribe: (() => void) | null = null;
  private activeOptions: VanillaGridOptions | null = null;
  private attributeOptions: Partial<GridOptions> = {};
  private attributeSyncScheduled = false;
  private iconOverrides: UiGridIconOverrides = {};
  private templateObserver: MutationObserver | null = null;
  private openPinMenuColumn: string | null = null;
  private focusedCell: { rowId: string; columnName: string } | null = null;
  private draggedColumnName: string | null = null;
  private dropTargetColumnName: string | null = null;
  private scrollPosition = 0;
  private horizontalScrollPosition = 0;
  private scrollFrame: number | null = null;
  private suppressScrollEvent = false;
  private lastVirtualStartIndex = -1;
  private measuredHeaderStickyHeight = 0;
  private measuredFilterStickyHeight = 0;
  private stickyHeightRelayoutQueued = false;
  private benchmarkAverage = '—';
  private skipNextRender = false;
  private dataFrame: number | null = null;
  private pendingPatchedRowIds: Set<string> | null = null;
  private pendingDataRefreshMode: 'patch' | 'virtual' | 'full' | null = null;
  private lastScrollActivityAt = 0;

  static get observedAttributes(): string[] {
    return [
      // Scalar attributes
      'grid-id',
      'title',
      'row-height',
      'header-row-height',
      'viewport-height',
      'pagination-page-size',
      'pagination-current-page',
      'total-items',
      'virtualization-threshold',
      'tree-children-field',
      'tree-indent',
      'expandable-row-height',
      'expandable-row-header-width',
      'empty-message',
      'infinite-scroll-rows-from-end',
      // JSON attributes
      'column-defs',
      'data',
      'grouping',
      'pagination-page-sizes',
      // Boolean flags
      'enable-sorting',
      'enable-filtering',
      'enable-grouping',
      'enable-pinning',
      'enable-column-moving',
      'enable-cell-edit',
      'enable-cell-edit-on-focus',
      'enable-pagination',
      'enable-pagination-controls',
      'use-external-pagination',
      'enable-expandable',
      'enable-tree-view',
      'show-tree-expand-no-children',
      'tree-row-header-always-visible',
      'enable-auto-resize',
      'enable-virtualization',
      'infinite-scroll-up',
      'infinite-scroll-down',
    ];
  }

  get options(): GridOptions {
    if (this.activeOptions !== null) {
      return this.buildEffectiveOptions(this.activeOptions);
    }
    // No imperative options set yet: safe defaults with attributes taking priority.
    return {
      id: '__ui-grid-pending__',
      data: [],
      columnDefs: [],
      ...this.attributeOptions,
    } as GridOptions;
  }

  set options(value: GridOptions) {
    this.activeOptions = value as VanillaGridOptions;
    this.iconOverrides = this.activeOptions.iconOverrides ?? {};
    this.ensureController(this.buildEffectiveOptions(this.activeOptions));
  }

  attributeChangedCallback(
    _name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ): void {
    // Debounce multiple rapid attribute changes via microtask.
    if (!this.attributeSyncScheduled) {
      this.attributeSyncScheduled = true;
      queueMicrotask(() => {
        this.attributeSyncScheduled = false;
        this.syncAttributesToOptions();
      });
    }
  }

  private syncAttributesToOptions(): void {
    this.attributeOptions = {};

    // Scalar string attributes
    const gridId = this.getAttribute('grid-id');
    if (gridId !== null) this.attributeOptions.id = gridId;

    const title = this.getAttribute('title');
    if (title !== null) this.attributeOptions.title = title;

    const emptyMessage = this.getAttribute('empty-message');
    if (emptyMessage !== null) this.attributeOptions.emptyMessage = emptyMessage;

    const treeChildrenField = this.getAttribute('tree-children-field');
    if (treeChildrenField !== null) this.attributeOptions.treeChildrenField = treeChildrenField;

    // Scalar number attributes
    const rowHeight = this.parseNumberAttribute('row-height');
    if (rowHeight !== undefined) this.attributeOptions.rowHeight = rowHeight;

    const headerRowHeight = this.parseNumberAttribute('header-row-height');
    if (headerRowHeight !== undefined)
      this.attributeOptions.headerRowHeight = headerRowHeight;

    const viewportHeight = this.parseNumberAttribute('viewport-height');
    if (viewportHeight !== undefined) this.attributeOptions.viewportHeight = viewportHeight;

    const paginationPageSize = this.parseNumberAttribute('pagination-page-size');
    if (paginationPageSize !== undefined)
      this.attributeOptions.paginationPageSize = paginationPageSize;

    const paginationCurrentPage = this.parseNumberAttribute('pagination-current-page');
    if (paginationCurrentPage !== undefined)
      this.attributeOptions.paginationCurrentPage = paginationCurrentPage;

    const totalItems = this.parseNumberAttribute('total-items');
    if (totalItems !== undefined) this.attributeOptions.totalItems = totalItems;

    const virtualizationThreshold = this.parseNumberAttribute('virtualization-threshold');
    if (virtualizationThreshold !== undefined)
      this.attributeOptions.virtualizationThreshold = virtualizationThreshold;

    const treeIndent = this.parseNumberAttribute('tree-indent');
    if (treeIndent !== undefined) this.attributeOptions.treeIndent = treeIndent;

    const expandableRowHeight = this.parseNumberAttribute('expandable-row-height');
    if (expandableRowHeight !== undefined)
      this.attributeOptions.expandableRowHeight = expandableRowHeight;

    const expandableRowHeaderWidth = this.parseNumberAttribute(
      'expandable-row-header-width',
    );
    if (expandableRowHeaderWidth !== undefined)
      this.attributeOptions.expandableRowHeaderWidth = expandableRowHeaderWidth;

    const infiniteScrollRowsFromEnd = this.parseNumberAttribute(
      'infinite-scroll-rows-from-end',
    );
    if (infiniteScrollRowsFromEnd !== undefined)
      this.attributeOptions.infiniteScrollRowsFromEnd = infiniteScrollRowsFromEnd;

    // Boolean attributes
    const enableSorting = this.parseBooleanAttribute('enable-sorting');
    if (enableSorting !== undefined) this.attributeOptions.enableSorting = enableSorting;

    const enableFiltering = this.parseBooleanAttribute('enable-filtering');
    if (enableFiltering !== undefined) this.attributeOptions.enableFiltering = enableFiltering;

    const enableGrouping = this.parseBooleanAttribute('enable-grouping');
    if (enableGrouping !== undefined) this.attributeOptions.enableGrouping = enableGrouping;

    const enablePinning = this.parseBooleanAttribute('enable-pinning');
    if (enablePinning !== undefined) this.attributeOptions.enablePinning = enablePinning;

    const enableColumnMoving = this.parseBooleanAttribute('enable-column-moving');
    if (enableColumnMoving !== undefined)
      this.attributeOptions.enableColumnMoving = enableColumnMoving;

    const enableColumnResizing = this.parseBooleanAttribute('enable-column-resizing');
    if (enableColumnResizing !== undefined)
      this.attributeOptions.enableColumnResizing = enableColumnResizing;

    const enableCellEdit = this.parseBooleanAttribute('enable-cell-edit');
    if (enableCellEdit !== undefined) this.attributeOptions.enableCellEdit = enableCellEdit;

    const enableCellEditOnFocus = this.parseBooleanAttribute('enable-cell-edit-on-focus');
    if (enableCellEditOnFocus !== undefined)
      this.attributeOptions.enableCellEditOnFocus = enableCellEditOnFocus;

    const enablePagination = this.parseBooleanAttribute('enable-pagination');
    if (enablePagination !== undefined)
      this.attributeOptions.enablePagination = enablePagination;

    const enablePaginationControls = this.parseBooleanAttribute(
      'enable-pagination-controls',
    );
    if (enablePaginationControls !== undefined)
      this.attributeOptions.enablePaginationControls = enablePaginationControls;

    const useExternalPagination = this.parseBooleanAttribute('use-external-pagination');
    if (useExternalPagination !== undefined)
      this.attributeOptions.useExternalPagination = useExternalPagination;

    const enableExpandable = this.parseBooleanAttribute('enable-expandable');
    if (enableExpandable !== undefined) this.attributeOptions.enableExpandable = enableExpandable;

    const enableTreeView = this.parseBooleanAttribute('enable-tree-view');
    if (enableTreeView !== undefined) this.attributeOptions.enableTreeView = enableTreeView;

    const showTreeExpandNoChildren = this.parseBooleanAttribute(
      'show-tree-expand-no-children',
    );
    if (showTreeExpandNoChildren !== undefined)
      this.attributeOptions.showTreeExpandNoChildren = showTreeExpandNoChildren;

    const treeRowHeaderAlwaysVisible = this.parseBooleanAttribute(
      'tree-row-header-always-visible',
    );
    if (treeRowHeaderAlwaysVisible !== undefined)
      this.attributeOptions.treeRowHeaderAlwaysVisible = treeRowHeaderAlwaysVisible;

    const enableAutoResize = this.parseBooleanAttribute('enable-auto-resize');
    if (enableAutoResize !== undefined) this.attributeOptions.enableAutoResize = enableAutoResize;

    const enableVirtualization = this.parseBooleanAttribute('enable-virtualization');
    if (enableVirtualization !== undefined)
      this.attributeOptions.enableVirtualization = enableVirtualization;

    const infiniteScrollUp = this.parseBooleanAttribute('infinite-scroll-up');
    if (infiniteScrollUp !== undefined) this.attributeOptions.infiniteScrollUp = infiniteScrollUp;

    const infiniteScrollDown = this.parseBooleanAttribute('infinite-scroll-down');
    if (infiniteScrollDown !== undefined)
      this.attributeOptions.infiniteScrollDown = infiniteScrollDown;

    // JSON attributes
    const columnDefs = this.parseJsonAttribute<GridColumnDef[]>('column-defs');
    if (columnDefs !== undefined) this.attributeOptions.columnDefs = columnDefs;

    const data = this.parseJsonAttribute<GridRecord[]>('data');
    if (data !== undefined) this.attributeOptions.data = data;

    const grouping = this.parseJsonAttribute('grouping');
    if (grouping !== undefined && grouping !== null)
      this.attributeOptions.grouping = grouping;

    const paginationPageSizes = this.parseJsonAttribute<number[] | null>(
      'pagination-page-sizes',
    );
    if (paginationPageSizes !== undefined)
      this.attributeOptions.paginationPageSizes = paginationPageSizes;

    // Re-render with the merged options.
    if (this.activeOptions !== null) {
      this.ensureController(this.buildEffectiveOptions(this.activeOptions));
    } else {
      // Purely declarative path: attributes drive the grid without an imperative bridge.
      this.ensureController({
        id: '__ui-grid-pending__',
        data: [],
        columnDefs: [],
        ...this.attributeOptions,
      } as VanillaGridOptions);
    }
  }

  private parseBooleanAttribute(name: string): boolean | undefined {
    return this.hasAttribute(name) ? true : undefined;
  }

  private parseNumberAttribute(name: string): number | undefined {
    const raw = this.getAttribute(name);
    if (raw === null) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseJsonAttribute<T = unknown>(name: string): T | undefined {
    const raw = this.getAttribute(name);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn(`<ui-grid-element>: invalid JSON in "${name}" attribute`, e);
      return undefined;
    }
  }

  get controlIcons(): UiGridIconOverrides {
    return this.iconOverrides;
  }

  set controlIcons(value: UiGridIconOverrides) {
    this.iconOverrides = { ...value };
    this.render();
  }

  // ─────────────────────────────────────────────────────────────────
  // Individual property accessors (mirrors of HTML attributes)
  // ─────────────────────────────────────────────────────────────────

  get gridId(): string {
    return this.options.id ?? '';
  }
  set gridId(value: string) {
    this.activeOptions = { ...this.activeOptions, id: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  // @ts-ignore: Intentional override of HTMLElement.title
  get title(): string {
    return this.options.title ?? '';
  }
  // @ts-ignore: Intentional override of HTMLElement.title
  set title(value: string) {
    this.activeOptions = { ...this.activeOptions, title: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get rowHeight(): number {
    return this.options.rowHeight ?? 40;
  }
  set rowHeight(value: number) {
    this.activeOptions = { ...this.activeOptions, rowHeight: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get headerRowHeight(): number {
    return this.options.headerRowHeight ?? 50;
  }
  set headerRowHeight(value: number) {
    this.activeOptions = { ...this.activeOptions, headerRowHeight: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get viewportHeight(): number {
    return this.options.viewportHeight ?? 560;
  }
  set viewportHeight(value: number) {
    this.activeOptions = { ...this.activeOptions, viewportHeight: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get paginationPageSize(): number {
    return this.options.paginationPageSize ?? 25;
  }
  set paginationPageSize(value: number) {
    this.activeOptions = { ...this.activeOptions, paginationPageSize: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get paginationCurrentPage(): number {
    return this.options.paginationCurrentPage ?? 1;
  }
  set paginationCurrentPage(value: number) {
    this.activeOptions = { ...this.activeOptions, paginationCurrentPage: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get totalItems(): number | undefined {
    return this.options.totalItems;
  }
  set totalItems(value: number | undefined) {
    this.activeOptions = { ...this.activeOptions, totalItems: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get virtualizationThreshold(): number {
    return this.options.virtualizationThreshold ?? 40;
  }
  set virtualizationThreshold(value: number) {
    this.activeOptions = { ...this.activeOptions, virtualizationThreshold: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get treeChildrenField(): string {
    return this.options.treeChildrenField ?? 'children';
  }
  set treeChildrenField(value: string) {
    this.activeOptions = { ...this.activeOptions, treeChildrenField: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get treeIndent(): number {
    return this.options.treeIndent ?? 20;
  }
  set treeIndent(value: number) {
    this.activeOptions = { ...this.activeOptions, treeIndent: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get expandableRowHeight(): number {
    return this.options.expandableRowHeight ?? 150;
  }
  set expandableRowHeight(value: number) {
    this.activeOptions = { ...this.activeOptions, expandableRowHeight: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get expandableRowHeaderWidth(): number {
    return this.options.expandableRowHeaderWidth ?? 40;
  }
  set expandableRowHeaderWidth(value: number) {
    this.activeOptions = { ...this.activeOptions, expandableRowHeaderWidth: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get emptyMessage(): string {
    return this.options.emptyMessage ?? 'No data available.';
  }
  set emptyMessage(value: string) {
    this.activeOptions = { ...this.activeOptions, emptyMessage: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get infiniteScrollRowsFromEnd(): number {
    return this.options.infiniteScrollRowsFromEnd ?? 10;
  }
  set infiniteScrollRowsFromEnd(value: number) {
    this.activeOptions = { ...this.activeOptions, infiniteScrollRowsFromEnd: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get columnDefs(): readonly GridColumnDef[] {
    return this.options.columnDefs;
  }
  set columnDefs(value: readonly GridColumnDef[]) {
    this.activeOptions = { ...this.activeOptions, columnDefs: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get data(): readonly GridRecord[] {
    return this.options.data;
  }
  set data(value: readonly GridRecord[]) {
    this.activeOptions = { ...this.activeOptions, data: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableSorting(): boolean {
    return this.options.enableSorting ?? true;
  }
  set enableSorting(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableSorting: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableFiltering(): boolean {
    return this.options.enableFiltering ?? true;
  }
  set enableFiltering(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableFiltering: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableGrouping(): boolean {
    return this.options.enableGrouping ?? true;
  }
  set enableGrouping(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableGrouping: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enablePinning(): boolean {
    return this.options.enablePinning ?? true;
  }
  set enablePinning(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enablePinning: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableColumnMoving(): boolean {
    return this.options.enableColumnMoving ?? true;
  }
  set enableColumnMoving(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableColumnMoving: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableColumnResizing(): boolean {
    return (this.options as any).enableColumnResizing ?? true;
  }
  set enableColumnResizing(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableColumnResizing: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableCellEdit(): boolean {
    return this.options.enableCellEdit ?? false;
  }
  set enableCellEdit(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableCellEdit: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableCellEditOnFocus(): boolean {
    return this.options.enableCellEditOnFocus ?? false;
  }
  set enableCellEditOnFocus(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableCellEditOnFocus: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enablePagination(): boolean {
    return this.options.enablePagination ?? false;
  }
  set enablePagination(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enablePagination: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enablePaginationControls(): boolean {
    return this.options.enablePaginationControls ?? true;
  }
  set enablePaginationControls(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enablePaginationControls: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get useExternalPagination(): boolean {
    return this.options.useExternalPagination ?? false;
  }
  set useExternalPagination(value: boolean) {
    this.activeOptions = { ...this.activeOptions, useExternalPagination: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableExpandable(): boolean {
    return this.options.enableExpandable ?? false;
  }
  set enableExpandable(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableExpandable: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableTreeView(): boolean {
    return this.options.enableTreeView ?? false;
  }
  set enableTreeView(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableTreeView: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get showTreeExpandNoChildren(): boolean {
    return this.options.showTreeExpandNoChildren ?? false;
  }
  set showTreeExpandNoChildren(value: boolean) {
    this.activeOptions = { ...this.activeOptions, showTreeExpandNoChildren: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get treeRowHeaderAlwaysVisible(): boolean {
    return this.options.treeRowHeaderAlwaysVisible ?? false;
  }
  set treeRowHeaderAlwaysVisible(value: boolean) {
    this.activeOptions = { ...this.activeOptions, treeRowHeaderAlwaysVisible: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableAutoResize(): boolean {
    return this.options.enableAutoResize ?? false;
  }
  set enableAutoResize(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableAutoResize: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get enableVirtualization(): boolean {
    return this.options.enableVirtualization ?? true;
  }
  set enableVirtualization(value: boolean) {
    this.activeOptions = { ...this.activeOptions, enableVirtualization: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get infiniteScrollUp(): boolean {
    return this.options.infiniteScrollUp ?? false;
  }
  set infiniteScrollUp(value: boolean) {
    this.activeOptions = { ...this.activeOptions, infiniteScrollUp: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get infiniteScrollDown(): boolean {
    return this.options.infiniteScrollDown ?? false;
  }
  set infiniteScrollDown(value: boolean) {
    this.activeOptions = { ...this.activeOptions, infiniteScrollDown: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get grouping(): unknown {
    return this.options.grouping;
  }
  set grouping(value: unknown) {
    this.activeOptions = { ...this.activeOptions, grouping: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  get paginationPageSizes(): number[] | null | undefined {
    return this.options.paginationPageSizes;
  }
  set paginationPageSizes(value: number[] | null | undefined) {
    this.activeOptions = { ...this.activeOptions, paginationPageSizes: value } as any;
    this.ensureController(this.buildEffectiveOptions(this.activeOptions as VanillaGridOptions));
  }

  getState(): GridSaveState | null {
    return this.controller?.getState() ?? null;
  }

  setState(state: Partial<GridSaveState>): void {
    this.controller?.setState(state);
  }

  /**
   * Fast-path: update only row data without rebuilding the shadow DOM.
   * The pipeline is updated synchronously; DOM patching is deferred to the
   * next animation frame so it never interrupts an in-progress scroll paint.
   * If multiple ticks arrive before the frame fires, only the latest wins.
   * If a scroll-triggered full render fires first, the frame is cancelled
   * (the fresh innerHTML already reflects the latest data).
   */
  setData(rows: GridRecord[]): void {
    const controller = this.controller;
    if (!controller) {
      return;
    }

    const previousSnapshot = this.snapshot;

    // Update the pipeline synchronously (cheap, no DOM work).
    this.skipNextRender = true;
    controller.refreshData(rows);
    this.skipNextRender = false;

    const { mode, changedRowIds } = this.classifyDataRefresh(previousSnapshot, this.snapshot);
    if (mode === null) {
      return;
    }

    this.pendingDataRefreshMode = mode;
    this.pendingPatchedRowIds = changedRowIds;

    // Schedule DOM patching on the next paint — latest call wins.
    if (this.dataFrame !== null) {
      cancelAnimationFrame(this.dataFrame);
    }
    this.dataFrame = requestAnimationFrame(() => {
      this.flushPendingDataRefresh();
    });
  }

  private flushPendingDataRefresh(): void {
    this.dataFrame = null;

    const mode = this.pendingDataRefreshMode;
    if (mode === null) {
      return;
    }

    if (Date.now() - this.lastScrollActivityAt < 80) {
      this.dataFrame = requestAnimationFrame(() => {
        this.flushPendingDataRefresh();
      });
      return;
    }

    const changedRowIds = this.pendingPatchedRowIds;
    this.pendingDataRefreshMode = null;
    this.pendingPatchedRowIds = null;

    if (mode === 'patch') {
      this.patchCells(changedRowIds ?? undefined);
      return;
    }

    if (mode === 'virtual') {
      this.renderVirtualBody();
      return;
    }

    this.render();
  }

  private patchCells(changedRowIds?: ReadonlySet<string>): void {
    const snapshot = this.snapshot;
    if (!snapshot) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Build O(1) lookup maps from the current pipeline snapshot.
    const rowMap = new Map<string, GridRow>();
    const rowIndexMap = new Map<string, number>();
    for (const row of snapshot.pipeline.visibleRows) {
      rowMap.set(row.id, row);
      rowIndexMap.set(row.id, rowIndexMap.size);
    }
    const colMap = new Map<string, GridColumnDef>();
    const templateMarkupMap = new Map<string, string | null>();
    for (const col of snapshot.visibleColumns) {
      colMap.set(col.name, col);
      templateMarkupMap.set(col.name, this.getTemplateMarkup(this.cellSlotName(col)));
    }

    // Patch every rendered body cell in-place.
    const cells = root.querySelectorAll<HTMLElement>('[data-row][data-column]');
    for (const cell of cells) {
      const rowId = cell.dataset['row'];
      const colName = cell.dataset['column'];
      if (!rowId || !colName) continue;
      if (changedRowIds && !changedRowIds.has(rowId)) continue;

      const row = rowMap.get(rowId);
      const column = colMap.get(colName);
      if (!row || !column) continue;
      if (cell.classList.contains('cell-editing')) continue;

      const cellContent = cell.querySelector<HTMLElement>('.cell-content');
      if (!cellContent) continue;

      const newContent = this.renderCellTemplateFromMarkup(
        row,
        column,
        rowIndexMap.get(rowId) ?? 0,
        templateMarkupMap.get(colName) ?? null,
      );
      if (cellContent.innerHTML !== newContent) {
        cellContent.innerHTML = newContent;
      }
    }
  }

  connectedCallback(): void {
    this.ensureShadowRoot();
    this.bindEvents();
    this.observeTemplateSlots();

    if (this.activeOptions) {
      this.ensureController(this.buildEffectiveOptions(this.activeOptions));
    } else {
      this.render();
    }
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.templateObserver?.disconnect();
    this.templateObserver = null;
    if (this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = null;
    }
  }

  private ensureShadowRoot(): ShadowRoot {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }

    return this.shadowRoot as ShadowRoot;
  }

  private ensureController(options: VanillaGridOptions): void {
    if (this.controller) {
      this.controller.setOptions(options);
      return;
    }

    this.controller = createVanillaGridController(options);
    this.unsubscribe = this.controller.subscribe((snapshot) => {
      this.snapshot = snapshot;
      this.render();
    });
  }

  private observeTemplateSlots(): void {
    if (this.templateObserver) {
      return;
    }

    this.templateObserver = new MutationObserver(() => {
      if (this.activeOptions) {
        this.ensureController(this.buildEffectiveOptions(this.activeOptions));
      } else {
        this.render();
      }
    });

    this.templateObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['slot'],
    });
  }

  private buildEffectiveOptions(options: VanillaGridOptions): VanillaGridOptions {
    // Merge: attributes are overridden by explicit JS property values.
    // JS property always wins: { ...attributeOptions, ...options }
    const merged = {
      ...this.attributeOptions,
      ...options,
    } as VanillaGridOptions;

    const hasExpandableSlot = this.getTemplateMarkup('expandable-row') !== null;
    if (merged.enableExpandable && hasExpandableSlot && !merged.expandableRowTemplate) {
      merged.expandableRowTemplate = {
        createEmbeddedView: () => undefined,
      };
    }

    return merged;
  }

  private bindEvents(): void {
    const root = this.ensureShadowRoot();
    if ((root as ShadowRoot & { __uiGridBound?: boolean }).__uiGridBound) {
      return;
    }

    root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !this.controller || !this.snapshot) {
        return;
      }

      const actionNode = target.closest<HTMLElement>('[data-action]');
      if (!actionNode) {
        return;
      }

      const action = actionNode.dataset['action'];
      if (!action) {
        return;
      }

      if (this.openPinMenuColumn && !target.closest('.pin-control')) {
        this.openPinMenuColumn = null;
        this.render();
        return;
      }

      if (action === 'sort') {
        const columnName = actionNode.dataset['column'];
        if (columnName) {
          this.controller.toggleSort(columnName);
        }
        return;
      }

      if (action === 'group') {
        const columnName = actionNode.dataset['column'];
        if (columnName) {
          this.controller.toggleGrouping(columnName);
        }
        return;
      }

      if (action === 'toggle-group') {
        const groupId = actionNode.dataset['group'];
        if (groupId) {
          const collapsed = actionNode.dataset['collapsed'] !== 'true';
          this.controller.setCollapsedGroup(groupId, collapsed);
        }
        return;
      }

      if (action === 'pin-trigger') {
        const columnName = actionNode.dataset['column'];
        const column = columnName
          ? this.snapshot.visibleColumns.find((candidate) => candidate.name === columnName)
          : undefined;

        if (columnName && column) {
          if (this.controller.isPinned(column)) {
            this.openPinMenuColumn = null;
            this.controller.pinColumn(columnName, 'none');
            return;
          }

          this.openPinMenuColumn = this.openPinMenuColumn === columnName ? null : columnName;
          this.render();
        }
        return;
      }

      if (action === 'pin-left' || action === 'pin-right') {
        const columnName = actionNode.dataset['column'];
        if (columnName) {
          this.openPinMenuColumn = null;
          this.controller.pinColumn(columnName, action === 'pin-left' ? 'left' : 'right');
        }
        return;
      }

      if (action === 'toggle-tree') {
        const rowId = actionNode.dataset['row'];
        if (rowId) {
          this.controller.toggleTreeRow(rowId);
        }
        return;
      }

      if (action === 'toggle-expand') {
        const rowId = actionNode.dataset['row'];
        if (rowId) {
          this.controller.toggleRowExpansion(rowId);
        }
        return;
      }

      if (action === 'page-prev') {
        this.controller.seekPage(this.snapshot.currentPage - 1);
        return;
      }

      if (action === 'page-next') {
        this.controller.seekPage(this.snapshot.currentPage + 1);
        return;
      }

      if (action === 'benchmark') {
        const result = this.controller.gridApi.core.benchmark();
        this.benchmarkAverage = result.averageMs.toFixed(2);
        this.render();
        return;
      }

      if (action === 'export-csv') {
        this.downloadCsv();
      }
    });

    root.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const cell = target.closest<HTMLElement>('.body-cell[data-row][data-column]');
      const rowId = cell?.dataset['row'];
      const columnName = cell?.dataset['column'];
      if (rowId && columnName) {
        this.focusedCell = { rowId, columnName };
      }
    });

    root.addEventListener('focusout', (event) => {
      const relatedTarget = (event as FocusEvent).relatedTarget as HTMLElement | null;
      if (!relatedTarget?.closest('.body-cell[data-row][data-column]')) {
        this.focusedCell = null;
      }
    });

    root.addEventListener('input', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !this.controller) {
        return;
      }

      if (target instanceof HTMLInputElement && target.dataset['role'] === 'filter') {
        const columnName = target.dataset['column'];
        if (columnName) {
          this.controller.setFilter(columnName, target.value);
        }
      }

      if (target instanceof HTMLInputElement && target.dataset['role'] === 'editor') {
        this.controller.updateEditingValue(target.value);
      }
    });

    root.addEventListener('change', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !this.controller) {
        return;
      }

      if (target instanceof HTMLSelectElement && target.dataset['role'] === 'page-size') {
        const value = Number.parseInt(target.value, 10);
        this.controller.setPageSize(value);
      }
    });

    root.addEventListener('dblclick', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !this.controller) {
        return;
      }

      const cell = target.closest<HTMLElement>('.body-cell');
      if (!cell) {
        return;
      }

      const rowId = cell.dataset['row'];
      const columnName = cell.dataset['column'];
      if (rowId && columnName) {
        this.controller.beginCellEdit(rowId, columnName, event);
      }
    });

    root.addEventListener('keydown', (event) => {
      const keyboardEvent = event as KeyboardEvent;
      const target = event.target as HTMLElement | null;
      if (!target || !this.controller) {
        return;
      }

      if (target instanceof HTMLInputElement && target.dataset['role'] === 'editor') {
        if (keyboardEvent.key === 'Enter') {
          event.preventDefault();
          this.controller.commitCellEdit();
          return;
        }

        if (keyboardEvent.key === 'Escape') {
          event.preventDefault();
          this.controller.cancelCellEdit();
        }

        return;
      }

      const cell = target.closest<HTMLElement>('.body-cell');
      if (!cell) {
        return;
      }

      const rowId = cell.dataset['row'];
      const columnName = cell.dataset['column'];
      if (!rowId || !columnName) {
        return;
      }

      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === 'F2') {
        event.preventDefault();
        this.controller.beginCellEdit(rowId, columnName, event);
        return;
      }

      if (
        keyboardEvent.key.length === 1 &&
        !keyboardEvent.ctrlKey &&
        !keyboardEvent.metaKey &&
        !keyboardEvent.altKey
      ) {
        event.preventDefault();
        this.controller.beginCellEdit(rowId, columnName, event);
        this.controller.updateEditingValue(keyboardEvent.key);
      }
    });

    root.addEventListener(
      'blur',
      (event) => {
        const target = event.target as HTMLElement | null;
        if (!target || !this.controller) {
          return;
        }

        if (target instanceof HTMLInputElement && target.dataset['role'] === 'editor') {
          this.controller.commitCellEdit();
        }
      },
      true,
    );

    root.addEventListener('dragstart', (event) => {
      const dragEvent = event as DragEvent;
      const target = event.target as HTMLElement | null;
      const headerCell = target?.closest<HTMLElement>('.header-cell[data-column]');

      if (!headerCell || !this.snapshot || !canGridMoveColumns(this.snapshot.options)) {
        event.preventDefault();
        return;
      }

      const columnName = headerCell.dataset['column'];
      if (!columnName || !dragEvent.dataTransfer) {
        event.preventDefault();
        return;
      }

      this.draggedColumnName = columnName;
      this.dropTargetColumnName = null;
      dragEvent.dataTransfer.effectAllowed = 'move';
      dragEvent.dataTransfer.setData('text/plain', columnName);
      headerCell.classList.add('is-dragging');
    });

    root.addEventListener('dragover', (event) => {
      const dragEvent = event as DragEvent;
      const target = event.target as HTMLElement | null;
      const headerCell = target?.closest<HTMLElement>('.header-cell[data-column]');

      if (!headerCell || !this.draggedColumnName || !dragEvent.dataTransfer) {
        return;
      }

      const columnName = headerCell.dataset['column'];
      if (!columnName || columnName === this.draggedColumnName) {
        return;
      }

      event.preventDefault();
      dragEvent.dataTransfer.dropEffect = 'move';

      if (this.dropTargetColumnName !== columnName) {
        root
          .querySelectorAll('.header-cell.is-drag-target')
          .forEach((element) => element.classList.remove('is-drag-target'));
        this.dropTargetColumnName = columnName;
        headerCell.classList.add('is-drag-target');
      }
    });

    root.addEventListener('dragleave', (event) => {
      const target = event.target as HTMLElement | null;
      const headerCell = target?.closest<HTMLElement>('.header-cell[data-column]');
      if (headerCell && headerCell.dataset['column'] === this.dropTargetColumnName) {
        headerCell.classList.remove('is-drag-target');
      }
    });

    root.addEventListener('drop', (event) => {
      event.preventDefault();
      const dragEvent = event as DragEvent;
      const target = event.target as HTMLElement | null;
      const headerCell = target?.closest<HTMLElement>('.header-cell[data-column]');
      const targetColumn = headerCell?.dataset['column'];
      const sourceColumn =
        this.draggedColumnName ?? dragEvent.dataTransfer?.getData('text/plain') ?? null;

      this.draggedColumnName = null;
      this.dropTargetColumnName = null;

      root
        .querySelectorAll('.header-cell.is-dragging, .header-cell.is-drag-target')
        .forEach((element) => element.classList.remove('is-dragging', 'is-drag-target'));

      if (!sourceColumn || !targetColumn || sourceColumn === targetColumn || !this.controller) {
        return;
      }

      this.controller.moveVisibleColumn(sourceColumn, targetColumn);
    });

    root.addEventListener('dragend', () => {
      this.draggedColumnName = null;
      this.dropTargetColumnName = null;
      root
        .querySelectorAll('.header-cell.is-dragging, .header-cell.is-drag-target')
        .forEach((element) => element.classList.remove('is-dragging', 'is-drag-target'));
    });

    root.addEventListener(
      'scroll',
      (event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.classList.contains('grid-table') || this.suppressScrollEvent) {
          return;
        }

        this.lastScrollActivityAt = Date.now();
        this.scrollPosition = target.scrollTop;
        this.horizontalScrollPosition = target.scrollLeft;
        if (!this.snapshot?.pipeline.virtualizationEnabled) {
          return;
        }

        const stickyChromeHeight =
          this.measuredHeaderStickyHeight + this.measuredFilterStickyHeight;
        const bodyScrollTop = Math.max(0, this.scrollPosition - stickyChromeHeight);
        const overscan = 4;
        const nextStartIndex = Math.max(
          0,
          Math.floor(bodyScrollTop / this.snapshot.rowSize) - overscan,
        );
        if (nextStartIndex === this.lastVirtualStartIndex) {
          return;
        }

        if (this.scrollFrame !== null) {
          cancelAnimationFrame(this.scrollFrame);
        }

        this.scrollFrame = requestAnimationFrame(() => {
          this.scrollFrame = null;
          this.renderVirtualBody();
        });
      },
      true,
    );

    (root as ShadowRoot & { __uiGridBound?: boolean }).__uiGridBound = true;
  }

  /**
   * Targeted update for virtual scroll: replaces only the rendered rows inside
   * the existing `.grid-virtual-body` without touching the scroll container.
   * This preserves momentum/inertia scrolling because the `.grid-table` element
   * is never destroyed.
   */
  private renderVirtualBody(): void {
    const snapshot = this.snapshot;
    if (!snapshot?.pipeline.virtualizationEnabled) {
      this.render();
      return;
    }

    const root = this.shadowRoot;
    const virtualBody = root?.querySelector<HTMLElement>('.grid-virtual-body');
    if (!root || !virtualBody) {
      this.render();
      return;
    }

    // Cancel any pending cell-only patch — the fresh rows we are about to
    // render already reflect the latest snapshot data.
    if (this.dataFrame !== null) {
      cancelAnimationFrame(this.dataFrame);
      this.dataFrame = null;
    }

    const stickyChromeHeight = this.measuredHeaderStickyHeight + this.measuredFilterStickyHeight;
    const viewportHeight = snapshot.options.viewportHeight ?? 560;
    const bodyViewportHeight = Math.max(snapshot.rowSize, viewportHeight - stickyChromeHeight);
    const bodyScrollTop = Math.max(0, this.scrollPosition - stickyChromeHeight);
    const overscan = 4;
    const startIndex = Math.max(0, Math.floor(bodyScrollTop / snapshot.rowSize) - overscan);
    this.lastVirtualStartIndex = startIndex;
    const visibleCount = Math.ceil(bodyViewportHeight / snapshot.rowSize) + overscan * 2;
    const itemsToRender = snapshot.pipeline.displayItems.slice(
      startIndex,
      Math.min(snapshot.pipeline.displayItems.length, startIndex + visibleCount),
    );
    const virtualOffset = startIndex * snapshot.rowSize;

    virtualBody.style.top = `${virtualOffset}px`;
    virtualBody.innerHTML = itemsToRender
      .map((item, index) => this.renderDisplayItem(item, startIndex + index))
      .join('');
  }

  private render(): void {
    if (this.skipNextRender) {
      return;
    }
    // A full render already incorporates the latest data — cancel any pending
    // frame-based updates to avoid redundant DOM mutations immediately after.
    if (this.dataFrame !== null) {
      cancelAnimationFrame(this.dataFrame);
      this.dataFrame = null;
    }
    if (this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = null;
    }
    const root = this.ensureShadowRoot();
    const snapshot = this.snapshot;
    const previousGridTable = root.querySelector<HTMLElement>('.grid-table');
    if (previousGridTable && !this.suppressScrollEvent) {
      this.scrollPosition = previousGridTable.scrollTop;
      this.horizontalScrollPosition = previousGridTable.scrollLeft;
    }

    if (!snapshot) {
      root.innerHTML = `<style>${GRID_CORE_CSS}</style><section class="grid-shell ui-grid-shell"><div class="empty-state ui-grid-no-row-overlay"><strong>No grid options provided.</strong></div></section>`;
      return;
    }

    const controller = this.controller!;
    const options = snapshot.options;
    const labels = snapshot.labels;
    const templateColumns = snapshot.gridTemplateColumns;
    const sortEnabled = controller.isSortingEnabled();
    const filterEnabled = controller.isFilteringEnabled();
    const groupingEnabled = controller.isGroupingEnabled();
    const pinningEnabled = controller.isPinningEnabled();
    const paginationEnabled = controller.isPaginationEnabled();
    const showPagination = controller.shouldShowPaginationControls();
    const virtualizationEnabled = snapshot.pipeline.virtualizationEnabled;
    const viewportHeight = options.viewportHeight ?? 560;
    const headerStickyTop = this.measuredHeaderStickyHeight || options.headerRowHeight || 50;
    const stickyChromeHeight = this.measuredHeaderStickyHeight + this.measuredFilterStickyHeight;
    const bodyViewportHeight = Math.max(snapshot.rowSize, viewportHeight - stickyChromeHeight);
    let startIndex = 0;
    let itemsToRender = snapshot.pipeline.displayItems;
    let virtualOffset = 0;
    const totalVirtualHeight = snapshot.pipeline.displayItems.length * snapshot.rowSize;

    if (virtualizationEnabled) {
      const bodyScrollTop = Math.max(0, this.scrollPosition - stickyChromeHeight);
      const overscan = 4;
      startIndex = Math.max(0, Math.floor(bodyScrollTop / snapshot.rowSize) - overscan);
      this.lastVirtualStartIndex = startIndex;
      const visibleCount = Math.ceil(bodyViewportHeight / snapshot.rowSize) + overscan * 2;
      itemsToRender = snapshot.pipeline.displayItems.slice(
        startIndex,
        Math.min(snapshot.pipeline.displayItems.length, startIndex + visibleCount),
      );
      virtualOffset = startIndex * snapshot.rowSize;
    } else {
      this.lastVirtualStartIndex = -1;
    }

    const slotRegistry = this.renderSlotRegistry(snapshot.visibleColumns);
    const header = snapshot.visibleColumns
      .map((column) =>
        this.renderHeaderCell(column, sortEnabled, groupingEnabled, pinningEnabled, options),
      )
      .join('');

    const filterRow = filterEnabled
      ? `<div class="filter-grid ui-grid-header" style="grid-template-columns:${templateColumns}">${snapshot.visibleColumns
          .map((column) => this.renderFilterCell(column))
          .join('')}</div>`
      : '';

    const bodyContent = itemsToRender
      .map((item, index) => this.renderDisplayItem(item, startIndex + index))
      .join('');

    const body =
      snapshot.pipeline.displayItems.length > 0
        ? virtualizationEnabled
          ? `<div class="grid-virtual-spacer" style="height:${totalVirtualHeight}px"><div class="body-grid ui-grid-canvas grid-virtual-body" style="grid-template-columns:${templateColumns};top:${virtualOffset}px">${bodyContent}</div></div>`
          : `<div class="body-grid ui-grid-canvas" style="grid-template-columns:${templateColumns}">${bodyContent}</div>`
        : `<div class="empty-state ui-grid-no-row-overlay"><strong>${escapeHtml(options.emptyMessage ?? labels.emptyHeading)}</strong><p>${escapeHtml(labels.emptyDescription)}</p></div>`;

    const pagination = paginationEnabled && showPagination ? this.renderPagination(snapshot) : '';
    const hasViewportScroll = virtualizationEnabled || options.viewportHeight !== undefined;
    const gridTableStyle = `${hasViewportScroll ? `height:${viewportHeight}px;overflow-y:auto;` : ''}--ui-grid-header-sticky-top:${headerStickyTop}px;`;

    root.innerHTML = `<style>${GRID_CORE_CSS}</style>${slotRegistry}<section class="grid-frame ui-grid" role="grid" aria-label="${escapeHtml(options.title ?? 'Data grid')}"><div class="grid-table ui-grid-contents-wrapper" style="${gridTableStyle}"><div class="header-grid ui-grid-header ui-grid-header-canvas" style="grid-template-columns:${templateColumns}">${header}</div>${filterRow}${body}</div>${pagination}</section>`;

    const gridTable = root.querySelector<HTMLElement>('.grid-table');
    if (gridTable && (this.scrollPosition > 0 || this.horizontalScrollPosition > 0)) {
      this.suppressScrollEvent = true;
      if (this.scrollPosition > 0) {
        gridTable.scrollTop = this.scrollPosition;
      }
      if (this.horizontalScrollPosition > 0) {
        gridTable.scrollLeft = this.horizontalScrollPosition;
      }
      requestAnimationFrame(() => {
        this.suppressScrollEvent = false;
      });
    }

    const headerGrid = root.querySelector<HTMLElement>('.header-grid');
    const filterGrid = root.querySelector<HTMLElement>('.filter-grid');
    const nextHeaderStickyHeight = headerGrid?.offsetHeight ?? 0;
    const nextFilterStickyHeight = filterGrid?.offsetHeight ?? 0;
    const stickyHeightsChanged =
      nextHeaderStickyHeight !== this.measuredHeaderStickyHeight ||
      nextFilterStickyHeight !== this.measuredFilterStickyHeight;

    this.measuredHeaderStickyHeight = nextHeaderStickyHeight;
    this.measuredFilterStickyHeight = nextFilterStickyHeight;

    if (stickyHeightsChanged && !this.stickyHeightRelayoutQueued) {
      this.stickyHeightRelayoutQueued = true;
      requestAnimationFrame(() => {
        this.stickyHeightRelayoutQueued = false;
        if (!this.snapshot) {
          return;
        }
        this.render();
      });
    }
  }

  private renderHeaderCell(
    column: GridColumnDef,
    sortEnabled: boolean,
    groupingEnabled: boolean,
    pinningEnabled: boolean,
    options: GridOptions,
  ): string {
    const controller = this.controller!;
    const sortDirection = controller.getSortDirection(column);
    const sortLabel = controller.sortButtonLabel(column);
    const groupingLabel = controller.groupingButtonLabel(column);
    const canSort = sortEnabled && controller.isColumnSortable(column);
    const canGroup = groupingEnabled && column.enableGrouping !== false;
    const canPin = pinningEnabled && controller.isColumnPinnable(column);
    const isPinned = controller.isPinned(column);
    const pinOffset = isPinned ? controller.pinnedOffset(column) : null;
    const isPinnedLeftLast = controller.isPinnedLeftLast(column);
    const isPinnedRightFirst = controller.isPinnedRightFirst(column);
    const isDragTarget = this.dropTargetColumnName === column.name;
    const isDragging = this.draggedColumnName === column.name;
    const classes = [
      'header-cell',
      sortDirection !== SORT_DIRECTIONS.none ? 'is-active' : '',
      isPinned ? 'is-pinned' : '',
      isPinnedLeftLast ? 'is-pinned-left-last' : '',
      isPinnedRightFirst ? 'is-pinned-right-first' : '',
      this.openPinMenuColumn === column.name ? 'is-pin-menu-open' : '',
      isDragTarget ? 'is-drag-target' : '',
      isDragging ? 'is-dragging' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const stickyStyle = pinOffset ? `${pinOffset.side}:${pinOffset.offset};` : '';

    const sortIconKey =
      sortDirection === SORT_DIRECTIONS.asc
        ? 'sortAsc'
        : sortDirection === SORT_DIRECTIONS.desc
          ? 'sortDesc'
          : 'sortNone';

    const draggable = canGridMoveColumns(options) ? 'draggable="true"' : '';
    const pinLabel = isPinned
      ? (this.snapshot?.labels.unpin ?? 'Unpin')
      : (this.snapshot?.labels.pinColumn ?? 'Pin');
    const headerValue = escapeHtml(formatGridHeaderDisplayValue(buildGridHeaderContext(column)));

    return `<div class="${classes}" data-column="${escapeHtml(column.name)}" ${draggable} style="${stickyStyle}"><span class="header-label">${headerValue}</span><span class="header-actions">${sortEnabled ? `<button type="button" class="header-action" data-action="sort" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(sortLabel)}" ${canSort ? '' : 'disabled'}>${this.renderControlIcon(sortIconKey)}<span class="sr-only">${escapeHtml(sortLabel)}</span></button>` : ''}${groupingEnabled ? `<button type="button" class="chip-action${controller.isColumnGrouped(column) ? ' chip-action-active' : ''}" data-action="group" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(groupingLabel)}" ${canGroup ? '' : 'disabled'}>${this.renderControlIcon('group')}<span class="sr-only">${escapeHtml(groupingLabel)}</span></button>` : ''}${canPin ? `<div class="pin-control${this.openPinMenuColumn === column.name ? ' pin-control-open' : ''}"><button type="button" class="chip-action pin-trigger${isPinned ? ' chip-action-active' : ''}" data-action="pin-trigger" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(pinLabel)}">${this.renderControlIcon('pin')}<span class="sr-only">${escapeHtml(pinLabel)}</span></button><div class="pin-menu" role="menu" aria-label="${escapeHtml(pinLabel)}"><button type="button" class="pin-menu-action" data-action="pin-left" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(this.snapshot?.labels.pinLeft ?? 'Pin left')}">${this.renderIconWithClass('control-icon', 'pinLeft')}<span class="sr-only">${escapeHtml(this.snapshot?.labels.pinLeft ?? 'Pin left')}</span></button><button type="button" class="pin-menu-action" data-action="pin-right" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(this.snapshot?.labels.pinRight ?? 'Pin right')}">${this.renderIconWithClass('control-icon', 'pinRight')}<span class="sr-only">${escapeHtml(this.snapshot?.labels.pinRight ?? 'Pin right')}</span></button></div></div>` : ''}</span></div>`;
  }

  private renderFilterCell(column: GridColumnDef): string {
    const value = this.snapshot?.activeFilters[column.name] ?? '';
    const controller = this.controller!;
    const canFilter = controller.isColumnFilterable(column);
    const pinOffset = controller.isPinned(column) ? controller.pinnedOffset(column) : null;
    const classes = [
      'filter-cell',
      controller.isPinned(column) ? 'is-pinned' : '',
      controller.isPinnedLeftLast(column) ? 'is-pinned-left-last' : '',
      controller.isPinnedRightFirst(column) ? 'is-pinned-right-first' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const stickyStyle = pinOffset ? `${pinOffset.side}:${pinOffset.offset};` : '';
    return `<label class="${classes}" style="${stickyStyle}"><input class="ui-grid-filter-input" data-role="filter" data-column="${escapeHtml(column.name)}" placeholder="${escapeHtml(controller.filterPlaceholder(column))}" value="${escapeHtml(value)}" ${canFilter ? '' : 'disabled'}></label>`;
  }

  private renderDisplayItem(item: DisplayItem, displayIndex: number): string {
    if (!this.snapshot || !this.controller) {
      return '';
    }

    if (item.kind === 'group') {
      const group = asGroupItem(item);
      const iconKey = group.collapsed ? 'groupCollapsed' : 'groupExpanded';
      const disclosureLabel = this.controller.groupDisclosureLabel(group);
      return `<button type="button" class="group-row ui-grid-row ui-grid-group-row" data-action="toggle-group" data-group="${escapeHtml(group.id)}" data-collapsed="${group.collapsed ? 'true' : 'false'}" style="grid-column: 1 / -1; padding-inline-start:${group.depth * 20 + 10}px">${this.renderIconWithClass('toggle-icon group-disclosure-icon', iconKey)}<span class="sr-only">${escapeHtml(disclosureLabel)}</span><strong>${escapeHtml(group.field)}: ${escapeHtml(group.label)}</strong><span>${group.count} ${escapeHtml(this.snapshot.labels.groupRowsSuffix)}</span></button>`;
    }

    if (item.kind === 'expandable') {
      const row = (item as DisplayItem & { row: GridRow }).row;
      return `<div class="expandable-row ui-grid-row ui-grid-expandable-row" style="grid-column:1 / -1">${this.renderExpandableTemplate(row)}</div>`;
    }

    if (!isRowItem(item)) {
      return '';
    }

    return this.snapshot.visibleColumns
      .map((column) => this.renderBodyCell(item.row, column, displayIndex))
      .join('');
  }

  private renderBodyCell(row: GridRow, column: GridColumnDef, displayIndex: number): string {
    if (!this.snapshot || !this.controller) {
      return '';
    }

    const controller = this.controller;
    const rowId = row.id;
    const columnName = column.name;
    const editing = controller.isEditingCell(rowId, columnName);
    const pinOffset = controller.isPinned(column) ? controller.pinnedOffset(column) : null;
    const treeToggle = controller.showTreeToggle(row, column)
      ? `<button type="button" class="row-toggle" data-action="toggle-tree" data-row="${escapeHtml(rowId)}" aria-label="${escapeHtml(controller.treeToggleLabel(row))}">${this.renderIconWithClass('toggle-icon', controller.isTreeRowExpanded(row) ? 'treeExpanded' : 'treeCollapsed')}<span class="sr-only">${escapeHtml(controller.treeToggleLabel(row))}</span></button>`
      : '';
    const expandToggle = controller.showExpandToggle(row, column)
      ? `<button type="button" class="row-toggle row-toggle-expand" data-action="toggle-expand" data-row="${escapeHtml(rowId)}" aria-label="${escapeHtml(controller.expandToggleLabel(row))}">${this.renderIconWithClass('toggle-icon', row.expanded ? 'expandExpanded' : 'expandCollapsed')}<span class="sr-only">${escapeHtml(controller.expandToggleLabel(row))}</span></button>`
      : '';

    const content = editing
      ? `<input class="cell-editor" data-role="editor" data-row="${escapeHtml(rowId)}" data-column="${escapeHtml(columnName)}" type="${escapeHtml(controller.editorInputType(column))}" value="${escapeHtml(this.snapshot.editingValue)}">`
      : this.renderCellTemplate(row, column, displayIndex);

    const classes = [
      'body-cell',
      'ui-grid-cell',
      displayIndex % 2 !== 0 ? 'body-cell-odd' : '',
      column.align === 'center' ? 'align-center' : '',
      column.align === 'end' ? 'align-end' : '',
      controller.isPinned(column) ? 'is-pinned' : '',
      controller.isPinnedLeftLast(column) ? 'is-pinned-left-last' : '',
      controller.isPinnedRightFirst(column) ? 'is-pinned-right-first' : '',
      this.focusedCell?.rowId === rowId && this.focusedCell.columnName === columnName
        ? 'cell-focused'
        : '',
      editing ? 'cell-editing' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const stickyStyle = pinOffset ? `${pinOffset.side}:${pinOffset.offset};` : '';
    return `<div class="${classes}" tabindex="0" data-row="${escapeHtml(rowId)}" data-column="${escapeHtml(columnName)}" style="${stickyStyle}"><div class="cell-shell" style="padding-inline-start:${escapeHtml(controller.cellIndent(row, column))}">${treeToggle}${expandToggle}<div class="cell-content">${content}</div></div></div>`;
  }

  private renderPagination(snapshot: GridControllerSnapshot): string {
    const pageSizes = snapshot.options.paginationPageSizes ?? [10, 25, 50, 100];
    return `<footer class="pagination-bar ui-grid-pagination"><p>${snapshot.firstRowIndex + 1}-${snapshot.lastRowIndex + 1} of ${snapshot.pipeline.totalItems}</p><div class="pagination-controls"><button type="button" class="action action-secondary pagination-button" data-action="page-prev" aria-label="${escapeHtml(snapshot.labels.paginationPrevious)}" ${snapshot.currentPage <= 1 ? 'disabled' : ''}>${this.renderIconWithClass('pagination-icon', 'paginationPrev')}<span class="sr-only">${escapeHtml(snapshot.labels.paginationPrevious)}</span></button><span>${escapeHtml(snapshot.labels.paginationPage)} ${snapshot.currentPage} ${escapeHtml(snapshot.labels.paginationOf)} ${snapshot.totalPages}</span><button type="button" class="action action-secondary pagination-button" data-action="page-next" aria-label="${escapeHtml(snapshot.labels.paginationNext)}" ${snapshot.currentPage >= snapshot.totalPages ? 'disabled' : ''}>${this.renderIconWithClass('pagination-icon', 'paginationNext')}<span class="sr-only">${escapeHtml(snapshot.labels.paginationNext)}</span></button><label class="pagination-size"><span class="sr-only">${escapeHtml(snapshot.labels.paginationRows)}</span><select class="page-size" data-role="page-size">${pageSizes
      .map(
        (size) =>
          `<option value="${size}" ${size === snapshot.pageSize ? 'selected' : ''}>${size}</option>`,
      )
      .join('')}</select></label></div></footer>`;
  }

  private renderSlotRegistry(columns: readonly GridColumnDef[]): string {
    const cellSlots = columns
      .map((column) => `<slot name="${escapeHtml(this.cellSlotName(column))}"></slot>`)
      .join('');
    return `<div hidden class="slot-registry">${cellSlots}<slot name="expandable-row"></slot></div>`;
  }

  private renderCellTemplate(row: GridRow, column: GridColumnDef, displayIndex: number): string {
    const templateMarkup = this.getTemplateMarkup(this.cellSlotName(column));
    return this.renderCellTemplateFromMarkup(row, column, displayIndex, templateMarkup);
  }

  private renderCellTemplateFromMarkup(
    row: GridRow,
    column: GridColumnDef,
    displayIndex: number,
    templateMarkup: string | null,
  ): string {
    if (!templateMarkup) {
      return `<span class="cell-value">${escapeHtml(this.controller?.displayValue(row, column) ?? '')}</span>`;
    }

    const rawRow = row.entity as GridRecord;
    const rawValue = getCellValue(rawRow, column);
    const valueText = rawValue == null ? '' : String(rawValue);
    return this.interpolateTemplate(templateMarkup, {
      $implicit: rawValue,
      value: rawValue,
      valueText,
      valueLower: valueText.toLowerCase(),
      row: rawRow,
      column,
      rowIndex: this.rowIndexFor(row, displayIndex),
    });
  }

  private renderExpandableTemplate(row: GridRow): string {
    const templateMarkup = this.getTemplateMarkup('expandable-row');
    if (!templateMarkup) {
      return `<p>${escapeHtml(String(row.entity['name'] ?? row.id))}</p>`;
    }

    return this.interpolateTemplate(templateMarkup, {
      $implicit: row.entity,
      row: row.entity,
      expanded: row.expanded,
      rowIndex: this.rowIndexFor(row),
    });
  }

  private getTemplateMarkup(slotName: string): string | null {
    const template = this.querySelector<HTMLTemplateElement>(`template[slot="${slotName}"]`);
    return template?.innerHTML ?? null;
  }

  private interpolateTemplate(templateMarkup: string, context: Record<string, unknown>): string {
    return templateMarkup.replace(/{{\s*([^}]+?)\s*}}/g, (_match, expression) => {
      const value = this.resolveTemplateValue(context, String(expression).trim());
      return escapeHtml(value);
    });
  }

  private resolveTemplateValue(context: Record<string, unknown>, expression: string): unknown {
    const segments = expression.split('.').filter(Boolean);
    let current: unknown = context;

    for (const segment of segments) {
      if (current == null || typeof current !== 'object') {
        return '';
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return current ?? '';
  }

  private rowIndexFor(row: GridRow, fallback = 0): number {
    return (
      this.snapshot?.pipeline.visibleRows.findIndex((candidate) => candidate.id === row.id) ??
      fallback
    );
  }

  private classifyDataRefresh(
    previousSnapshot: GridControllerSnapshot | null,
    nextSnapshot: GridControllerSnapshot | null,
  ): { mode: 'patch' | 'virtual' | 'full' | null; changedRowIds: Set<string> | null } {
    if (!nextSnapshot) {
      return { mode: 'full', changedRowIds: null };
    }

    if (!previousSnapshot) {
      return {
        mode: nextSnapshot.pipeline.virtualizationEnabled ? 'virtual' : 'full',
        changedRowIds: null,
      };
    }

    if (previousSnapshot.visibleColumns.length !== nextSnapshot.visibleColumns.length) {
      return { mode: 'full', changedRowIds: null };
    }

    for (let index = 0; index < previousSnapshot.visibleColumns.length; index += 1) {
      if (previousSnapshot.visibleColumns[index]?.name !== nextSnapshot.visibleColumns[index]?.name) {
        return { mode: 'full', changedRowIds: null };
      }
    }

    const previousWindow = this.getRenderedDisplayWindow(previousSnapshot);
    const nextWindow = this.getRenderedDisplayWindow(nextSnapshot);
    if (
      previousWindow.startIndex !== nextWindow.startIndex ||
      previousWindow.items.length !== nextWindow.items.length
    ) {
      return {
        mode: nextSnapshot.pipeline.virtualizationEnabled ? 'virtual' : 'full',
        changedRowIds: null,
      };
    }

    const changedRowIds = new Set<string>();
    for (let index = 0; index < previousWindow.items.length; index += 1) {
      const previousItem = previousWindow.items[index];
      const nextItem = nextWindow.items[index];

      if (!previousItem || !nextItem || previousItem.kind !== 'row' || nextItem.kind !== 'row') {
        return {
          mode: nextSnapshot.pipeline.virtualizationEnabled ? 'virtual' : 'full',
          changedRowIds: null,
        };
      }

      if (previousItem.row.id !== nextItem.row.id) {
        return {
          mode: nextSnapshot.pipeline.virtualizationEnabled ? 'virtual' : 'full',
          changedRowIds: null,
        };
      }

      if (previousItem.row.entity !== nextItem.row.entity) {
        changedRowIds.add(nextItem.row.id);
      }
    }

    return {
      mode: changedRowIds.size > 0 ? 'patch' : null,
      changedRowIds: changedRowIds.size > 0 ? changedRowIds : null,
    };
  }

  private getRenderedDisplayWindow(snapshot: GridControllerSnapshot): {
    startIndex: number;
    items: readonly DisplayItem[];
  } {
    if (!snapshot.pipeline.virtualizationEnabled) {
      return {
        startIndex: 0,
        items: snapshot.pipeline.displayItems,
      };
    }

    const stickyChromeHeight = this.measuredHeaderStickyHeight + this.measuredFilterStickyHeight;
    const viewportHeight = snapshot.options.viewportHeight ?? 560;
    const bodyViewportHeight = Math.max(snapshot.rowSize, viewportHeight - stickyChromeHeight);
    const bodyScrollTop = Math.max(0, this.scrollPosition - stickyChromeHeight);
    const overscan = 4;
    const startIndex = Math.max(0, Math.floor(bodyScrollTop / snapshot.rowSize) - overscan);
    const visibleCount = Math.ceil(bodyViewportHeight / snapshot.rowSize) + overscan * 2;

    return {
      startIndex,
      items: snapshot.pipeline.displayItems.slice(
        startIndex,
        Math.min(snapshot.pipeline.displayItems.length, startIndex + visibleCount),
      ),
    };
  }

  private cellSlotName(column: GridColumnDef): string {
    return `cell-${column.name}`;
  }

  private downloadCsv(): void {
    if (!this.snapshot) {
      return;
    }

    const csv = exportCsvRows(this.snapshot.visibleColumns, this.snapshot.pipeline.visibleRows);
    const filename = sanitizeDownloadFilename(`${this.snapshot.options.id}.csv`);
    downloadGridCsvFile(csv, filename);
  }

  private renderControlIcon(key: UiGridControlIconKey): string {
    return this.renderIconWithClass('control-icon', key);
  }

  private renderIconWithClass(svgClass: string, key: UiGridControlIconKey): string {
    const icon = this.iconOverrides[key] ?? DEFAULT_ICONS[key];
    const viewBox = escapeHtml(icon.viewBox ?? '0 0 24 24');
    const path = escapeHtml(icon.path);
    return `<svg class="${svgClass}" viewBox="${viewBox}" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`;
  }
}

export async function defineStandaloneUiGridElement(tagName = 'ui-grid-element'): Promise<void> {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, UiGridStandaloneElement);
  }
}
