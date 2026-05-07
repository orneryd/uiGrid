import {
  SORT_DIRECTIONS,
  buildGridHeaderContext,
  canGridMoveColumns,
  downloadGridCsvFile,
  exportCsvRows,
  findNextGridCell,
  formatGridHeaderDisplayValue,
  getCellValue,
  isGridNavigationKey,
  isPrintableGridKey,
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
import emptyTemplate from './ui-grid-empty.html';
import gridShellTemplate from './ui-grid-shell.html';
import {
  iconMarkup,
  slotRegistryMarkup,
  filterRowMarkup,
  bodyVirtualMarkup,
  bodyStaticMarkup,
  emptyDataMarkup,
  expandableRowMarkup,
  treeToggleMarkup,
  expandToggleMarkup,
  cellEditorMarkup,
  cellValueMarkup,
  defaultExpandableMarkup,
  resizerMarkup,
} from './templates';
import { UIGridFilterCell } from './components/grid-filter-cell';
import { UIGridGroupRow } from './components/grid-group-row';
import { UIGridPagination } from './components/grid-pagination';
import { UIGridBodyCell } from './components/grid-body-cell';
import { UIGridHeaderCell } from './components/grid-header-cell';
import { UIGridTemplate } from './components/grid-template';
import { UIGridCellEditor } from './components/grid-cell-editor';

function escapeHtml(value: unknown): string {
  const text = String(value ?? '');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setAttr(el: HTMLElement, name: string, value: string): void {
  if (el.getAttribute(name) !== value) {
    el.setAttribute(name, value);
  }
}

function setClass(el: HTMLElement, value: string): void {
  if (el.className !== value) {
    el.className = value;
  }
}

function setStyle(el: HTMLElement, value: string): void {
  const current = el.getAttribute('style');
  if (value) {
    if (current !== value) el.setAttribute('style', value);
  } else if (current !== null) {
    el.removeAttribute('style');
  }
}

/**
 * Computes the class string for a body cell. Kept in one place so both the
 * initial-render markup builder and the patch path produce identical output.
 */
function bodyCellClass(
  isOdd: boolean,
  align: string,
  isPinned: boolean,
  isPinnedLeftLast: boolean,
  isPinnedRightFirst: boolean,
  isFocused: boolean,
  isEditing: boolean,
  isRowSelected: boolean,
  isRowFocused: boolean,
): string {
  let cls = 'body-cell ui-grid-cell';
  if (isOdd) cls += ' body-cell-odd';
  if (align === 'center') cls += ' align-center';
  else if (align === 'end') cls += ' align-end';
  if (isPinned) cls += ' is-pinned';
  if (isPinnedLeftLast) cls += ' is-pinned-left-last';
  if (isPinnedRightFirst) cls += ' is-pinned-right-first';
  if (isFocused) cls += ' cell-focused';
  if (isEditing) cls += ' cell-editing';
  // Matches the old ui.grid.selection directive's ng-class output. Row-level
  // state shows on every cell so selection stripes work across the whole row.
  if (isRowSelected) cls += ' ui-grid-row-selected';
  if (isRowFocused) cls += ' ui-grid-row-focused';
  return cls;
}

function headerCellClass(
  isSortActive: boolean,
  isPinned: boolean,
  isPinnedLeftLast: boolean,
  isPinnedRightFirst: boolean,
  isPinMenuOpen: boolean,
  isDragTarget: boolean,
  isDragging: boolean,
): string {
  let cls = 'header-cell';
  if (isSortActive) cls += ' is-active';
  if (isPinned) cls += ' is-pinned';
  if (isPinnedLeftLast) cls += ' is-pinned-left-last';
  if (isPinnedRightFirst) cls += ' is-pinned-right-first';
  if (isPinMenuOpen) cls += ' is-pin-menu-open';
  if (isDragTarget) cls += ' is-drag-target';
  if (isDragging) cls += ' is-dragging';
  return cls;
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/([\\".#:[\](){}+~> ])/g, '\\$1');
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
  private resolvedIcons: Record<UiGridControlIconKey, UiGridIconDefinition> = { ...DEFAULT_ICONS };
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

  // Template-facing properties for ui-grid-shell.html
  gridTitle = 'Data grid';
  gridTableStyle = '';
  templateColumns = '';
  slotRegistry = '';
  headerContent = '';
  filterRowContent = '';
  bodyContent = '';
  paginationContent = '';
  private dataFrame: number | null = null;
  private pendingPatchedRowIds: Set<string> | null = null;
  private pendingDataRefreshMode: 'patch' | 'virtual' | 'full' | null = null;
  private lastScrollActivityAt = 0;
  private lastStructureKey: string | null = null;
  private lastItemsFingerprint: string | null = null;
  private lastVirtualOffset = 0;
  private lastTotalVirtualHeight = 0;

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
      'enable-infinite-scroll',
      'infinite-scroll-up',
      'infinite-scroll-down',
      // Selection — ported from ui.grid.selection options.
      'enable-row-selection',
      'multi-select',
      'no-unselect',
      'modifier-keys-to-multi-select',
      'enable-row-header-selection',
      'enable-full-row-selection',
      'enable-focus-row-on-row-header-click',
      'enable-select-row-on-focus',
      'enable-select-all',
      'enable-selection-batch-event',
      'enable-footer-total-selected',
      'selection-row-header-width',
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
    this.rebuildResolvedIcons();
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
    if (headerRowHeight !== undefined) this.attributeOptions.headerRowHeight = headerRowHeight;

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

    const expandableRowHeaderWidth = this.parseNumberAttribute('expandable-row-header-width');
    if (expandableRowHeaderWidth !== undefined)
      this.attributeOptions.expandableRowHeaderWidth = expandableRowHeaderWidth;

    const infiniteScrollRowsFromEnd = this.parseNumberAttribute('infinite-scroll-rows-from-end');
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
    if (enablePagination !== undefined) this.attributeOptions.enablePagination = enablePagination;

    const enablePaginationControls = this.parseBooleanAttribute('enable-pagination-controls');
    if (enablePaginationControls !== undefined)
      this.attributeOptions.enablePaginationControls = enablePaginationControls;

    const useExternalPagination = this.parseBooleanAttribute('use-external-pagination');
    if (useExternalPagination !== undefined)
      this.attributeOptions.useExternalPagination = useExternalPagination;

    const enableExpandable = this.parseBooleanAttribute('enable-expandable');
    if (enableExpandable !== undefined) this.attributeOptions.enableExpandable = enableExpandable;

    const enableTreeView = this.parseBooleanAttribute('enable-tree-view');
    if (enableTreeView !== undefined) this.attributeOptions.enableTreeView = enableTreeView;

    const showTreeExpandNoChildren = this.parseBooleanAttribute('show-tree-expand-no-children');
    if (showTreeExpandNoChildren !== undefined)
      this.attributeOptions.showTreeExpandNoChildren = showTreeExpandNoChildren;

    const treeRowHeaderAlwaysVisible = this.parseBooleanAttribute('tree-row-header-always-visible');
    if (treeRowHeaderAlwaysVisible !== undefined)
      this.attributeOptions.treeRowHeaderAlwaysVisible = treeRowHeaderAlwaysVisible;

    const enableAutoResize = this.parseBooleanAttribute('enable-auto-resize');
    if (enableAutoResize !== undefined) this.attributeOptions.enableAutoResize = enableAutoResize;

    const enableVirtualization = this.parseBooleanAttribute('enable-virtualization');
    if (enableVirtualization !== undefined)
      this.attributeOptions.enableVirtualization = enableVirtualization;

    const enableInfiniteScroll = this.parseTriStateBooleanAttribute('enable-infinite-scroll');
    if (enableInfiniteScroll !== undefined)
      this.attributeOptions.enableInfiniteScroll = enableInfiniteScroll;

    const infiniteScrollUp = this.parseBooleanAttribute('infinite-scroll-up');
    if (infiniteScrollUp !== undefined) this.attributeOptions.infiniteScrollUp = infiniteScrollUp;

    const infiniteScrollDown = this.parseBooleanAttribute('infinite-scroll-down');
    if (infiniteScrollDown !== undefined)
      this.attributeOptions.infiniteScrollDown = infiniteScrollDown;

    // Selection — most flags default to true in the old grid, so we use
    // the tri-state parser to let consumers opt out with attr="false".
    const enableRowSelection = this.parseTriStateBooleanAttribute('enable-row-selection');
    if (enableRowSelection !== undefined)
      this.attributeOptions.enableRowSelection = enableRowSelection;
    const multiSelect = this.parseTriStateBooleanAttribute('multi-select');
    if (multiSelect !== undefined) this.attributeOptions.multiSelect = multiSelect;
    const noUnselect = this.parseTriStateBooleanAttribute('no-unselect');
    if (noUnselect !== undefined) this.attributeOptions.noUnselect = noUnselect;
    const modifierKeysToMultiSelect = this.parseTriStateBooleanAttribute(
      'modifier-keys-to-multi-select',
    );
    if (modifierKeysToMultiSelect !== undefined)
      this.attributeOptions.modifierKeysToMultiSelect = modifierKeysToMultiSelect;
    const enableRowHeaderSelection = this.parseTriStateBooleanAttribute(
      'enable-row-header-selection',
    );
    if (enableRowHeaderSelection !== undefined)
      this.attributeOptions.enableRowHeaderSelection = enableRowHeaderSelection;
    const enableFullRowSelection = this.parseTriStateBooleanAttribute('enable-full-row-selection');
    if (enableFullRowSelection !== undefined)
      this.attributeOptions.enableFullRowSelection = enableFullRowSelection;
    const enableFocusRowOnRowHeaderClick = this.parseTriStateBooleanAttribute(
      'enable-focus-row-on-row-header-click',
    );
    if (enableFocusRowOnRowHeaderClick !== undefined)
      this.attributeOptions.enableFocusRowOnRowHeaderClick = enableFocusRowOnRowHeaderClick;
    const enableSelectRowOnFocus = this.parseTriStateBooleanAttribute('enable-select-row-on-focus');
    if (enableSelectRowOnFocus !== undefined)
      this.attributeOptions.enableSelectRowOnFocus = enableSelectRowOnFocus;
    const enableSelectAll = this.parseTriStateBooleanAttribute('enable-select-all');
    if (enableSelectAll !== undefined) this.attributeOptions.enableSelectAll = enableSelectAll;
    const enableSelectionBatchEvent = this.parseTriStateBooleanAttribute(
      'enable-selection-batch-event',
    );
    if (enableSelectionBatchEvent !== undefined)
      this.attributeOptions.enableSelectionBatchEvent = enableSelectionBatchEvent;
    const enableFooterTotalSelected = this.parseTriStateBooleanAttribute(
      'enable-footer-total-selected',
    );
    if (enableFooterTotalSelected !== undefined)
      this.attributeOptions.enableFooterTotalSelected = enableFooterTotalSelected;
    const selectionRowHeaderWidth = this.parseNumberAttribute('selection-row-header-width');
    if (selectionRowHeaderWidth !== undefined)
      this.attributeOptions.selectionRowHeaderWidth = selectionRowHeaderWidth;

    // JSON attributes
    const columnDefs = this.parseJsonAttribute<GridColumnDef[]>('column-defs');
    if (columnDefs !== undefined) this.attributeOptions.columnDefs = columnDefs;

    const data = this.parseJsonAttribute<GridRecord[]>('data');
    if (data !== undefined) this.attributeOptions.data = data;

    const grouping = this.parseJsonAttribute('grouping');
    if (grouping !== undefined && grouping !== null) this.attributeOptions.grouping = grouping;

    const paginationPageSizes = this.parseJsonAttribute<number[] | null>('pagination-page-sizes');
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

  /** Tri-state boolean attribute. Returns true for present/"" /"true", false
   * for "false", undefined when the attribute is absent. Use this for flags
   * that default to true in the model, so consumers can explicitly opt out
   * with attr="false" without having to remove the attribute. */
  private parseTriStateBooleanAttribute(name: string): boolean | undefined {
    if (!this.hasAttribute(name)) return undefined;
    const raw = this.getAttribute(name);
    if (raw === null) return undefined;
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0' || normalized === 'off') return false;
    return true;
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
    this.rebuildResolvedIcons();
    this.render();
  }

  private rebuildResolvedIcons(): void {
    this.resolvedIcons = { ...DEFAULT_ICONS, ...this.iconOverrides };
  }

  private resolveIcon(key: UiGridControlIconKey): UiGridIconDefinition {
    return this.resolvedIcons[key];
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
    // Let the controller's cellNav.scrollToFocus delegate into our
    // element's scroll-and-focus helpers.
    this.controller.setCellNavScrollHandler((rowId, columnName) => {
      if (!rowId || !columnName) return;
      this.scrollFocusedRowIntoView(rowId);
      this.focusCellElement(rowId, columnName);
    });
    // Infinite-scroll resetScroll() brings the viewport back to the top.
    this.controller.setInfiniteScrollResetHandler(() => {
      const gridTable = this.shadowRoot?.querySelector<HTMLElement>('.grid-table');
      if (gridTable) {
        gridTable.scrollTop = 0;
        this.scrollPosition = 0;
      }
    });
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
      // Use composedPath to reach into sub-component shadow DOMs (pagination buttons, etc.).
      const realTarget = (event.composedPath()[0] ?? event.target) as HTMLElement | null;
      if (!realTarget || !this.controller || !this.snapshot) {
        return;
      }

      // Clicking inside a body cell seeds keyboard navigation. Some browsers
      // don't reliably focus a div with tabindex="0" on click, so we force it
      // here. This is required for arrow-key nav to work — otherwise focus
      // stays on the grid-table scroll container and arrows just scroll.
      const clickedCell =
        realTarget.closest?.<HTMLElement>('.body-cell[data-row][data-column]') ?? null;
      if (clickedCell && !realTarget.closest('[data-role="editor"]')) {
        const rowId = clickedCell.dataset['row'];
        const columnName = clickedCell.dataset['column'];
        if (rowId && columnName) {
          const previous = this.focusedCell;
          const next = { rowId, columnName };
          this.focusedCell = next;
          // Move the selection decoration onto the clicked cell immediately —
          // the grid shell doesn't re-render on every click, so we toggle the
          // class/data-attr directly.
          this.applyFocusedCellClass(previous, next);
          // Raise cellNav.navigate so consumers see the click as a focus
          // change (matches the old gridApi.cellNav.on.navigate wiring).
          this.controller.setCellNavFocus(rowId, columnName);
          // Focus unless the browser already handled it (e.g. clicking a
          // button inside the cell); check shadowRoot.activeElement.
          const activeInShadow = (this.shadowRoot?.activeElement ?? null) as HTMLElement | null;
          if (activeInShadow !== clickedCell && !activeInShadow?.closest?.('.body-cell')) {
            try {
              clickedCell.focus({ preventScroll: true });
            } catch {
              clickedCell.focus();
            }
          }
          // Row selection side effect — only fires when clicking a "real"
          // body cell (not a checkbox-column cell) and the corresponding
          // selection option is on. Ports the old uiGridSelection.uiGridCell
          // directive's click handler.
          this.handleRowSelectionClick(rowId, columnName, event);
        }
      }

      // Row-header checkbox column click — mirrors the old
      // selectionRowHeaderButtons directive: even when enableFullRowSelection
      // is off, clicking the header checkbox selects the row.
      const checkboxNode = realTarget.closest?.<HTMLElement>(
        '.body-cell[data-row][data-column="selectionRowHeaderCol"]',
      );
      if (checkboxNode) {
        const rowId = checkboxNode.dataset['row'];
        if (rowId) {
          event.stopPropagation();
          this.handleRowHeaderCheckboxClick(rowId, event);
        }
      }

      // Walk the composed path to find [data-action] across shadow boundaries.
      let actionNode: HTMLElement | null = null;
      for (const el of event.composedPath()) {
        if (el instanceof HTMLElement && el.dataset['action']) {
          actionNode = el;
          break;
        }
      }
      if (!actionNode) {
        return;
      }

      const action = actionNode.dataset['action'];
      if (!action) {
        return;
      }

      if (this.openPinMenuColumn && !realTarget.closest('.pin-control')) {
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

      if (action === 'select-all') {
        // Select-all / clear-all header checkbox — ports the old
        // headerButtonClick behavior: if currently selectAll, clear; else
        // selectAllVisible (plus special handling for noUnselect).
        const resolvedSel = this.controller.getResolvedSelectionOptions();
        if (this.snapshot?.selectAll) {
          this.controller.clearSelectedRows(event);
          if (resolvedSel.noUnselect) {
            this.controller.selectRowByVisibleIndex(0, event);
          }
        } else if (resolvedSel.multiSelect) {
          this.controller.selectAllVisibleRows(event);
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
      // Use composedPath to reach into sub-component shadow DOMs.
      const target = (event.composedPath()[0] ?? event.target) as HTMLElement | null;
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

    // Listen for the composed custom event from the pagination component's shadow DOM.
    root.addEventListener('grid-page-size', ((event: CustomEvent<{ pageSize: number }>) => {
      if (this.controller) {
        this.controller.setPageSize(event.detail.pageSize);
      }
    }) as EventListener);

    // Row-drag selection. Ports the old grid's "click-and-drag to paint a
    // selection across rows" UX. Initial direction (add-to-selection vs
    // remove-from-selection) is picked from the starting row's current
    // state, then every row the pointer drags across is forced to that
    // state. Stops on mouseup anywhere in the document.
    root.addEventListener('mousedown', (event) => {
      const mouseEvent = event as MouseEvent;
      if (mouseEvent.button !== 0) return;
      const realTarget = (event.composedPath()[0] ?? event.target) as HTMLElement | null;
      if (!realTarget || !this.controller || !this.snapshot) return;
      // Don't interfere with column resize / actions / editor / anything in
      // the header or filter row.
      if (realTarget.closest('.column-resizer')) return;
      if (realTarget.closest('[data-role="editor"]')) return;
      if (realTarget.closest('.header-cell')) return;
      if (realTarget.closest('.filter-cell')) return;
      const resolved = this.controller.getResolvedSelectionOptions();
      if (!resolved.enableRowSelection || !resolved.multiSelect) return;
      const startCell = realTarget.closest<HTMLElement>(
        '.body-cell[data-row][data-column]',
      );
      if (!startCell) return;
      const startRowId = startCell.dataset['row'];
      if (!startRowId) return;
      const isCheckboxCol = startCell.dataset['column'] === 'selectionRowHeaderCol';
      if (!isCheckboxCol && !resolved.enableFullRowSelection) return;
      // Clicks with modifier keys go through the single-click handler
      // instead of drag-paint, so shift/ctrl don't accidentally commit a
      // one-row drag on mouseup.
      if (mouseEvent.shiftKey || mouseEvent.ctrlKey || mouseEvent.metaKey) return;

      // Drag-paint tracking. We don't touch the start row on mousedown — the
      // click handler owns single-click semantics. The starting row only
      // gets painted once we observe an actual mousemove onto a DIFFERENT
      // row (i.e. the user is dragging). This avoids the flicker a plain
      // click used to cause, where mousedown-paint and click-toggle fired
      // back-to-back on the same row.
      const startSelected = this.snapshot.selectedRowIds.has(startRowId);
      const targetSelected = !startSelected;
      const touched = new Set<string>();
      let dragStarted = false;

      const paintRow = (rowId: string): void => {
        if (touched.has(rowId)) return;
        touched.add(rowId);
        const currentlySelected = this.snapshot?.selectedRowIds.has(rowId) ?? false;
        if (currentlySelected === targetSelected) return;
        const row = this.controller!.findRowByIdPublic(rowId);
        if (!row) return;
        if (targetSelected) this.controller!.selectRow(row.entity, event);
        else this.controller!.unSelectRow(row.entity, event);
      };

      const handleMove = (moveEvent: MouseEvent): void => {
        const path = moveEvent.composedPath();
        const firstEl = path[0] as HTMLElement | undefined;
        const cell = firstEl?.closest?.<HTMLElement>('.body-cell[data-row][data-column]');
        if (!cell) return;
        const rowId = cell.dataset['row'];
        if (!rowId) return;
        if (!dragStarted) {
          // First move that lands on a different row promotes this gesture
          // to a drag — at that point paint the starting row too, and
          // suppress the subsequent click so single-click semantics don't
          // double-fire on mouseup.
          if (rowId === startRowId) return;
          dragStarted = true;
          paintRow(startRowId);
        }
        paintRow(rowId);
      };

      const suppressNextClick = (e: Event): void => {
        e.stopPropagation();
        e.preventDefault();
        root.removeEventListener('click', suppressNextClick, true);
      };

      const handleUp = (): void => {
        window.removeEventListener('mousemove', handleMove, true);
        window.removeEventListener('mouseup', handleUp, true);
        if (dragStarted) {
          // Block the trailing `click` that fires after mouseup — its
          // selection semantics would clobber the drag result.
          root.addEventListener('click', suppressNextClick, true);
        }
      };

      window.addEventListener('mousemove', handleMove, true);
      window.addEventListener('mouseup', handleUp, true);
    });

    root.addEventListener('mousedown', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !this.controller) return;

      const resizer = target.closest<HTMLElement>('.column-resizer[data-column]');
      if (!resizer || !this.controller.canResizeColumns()) return;

      const columnName = resizer.dataset['column'];
      if (!columnName) return;

      const headerCell = resizer.closest<HTMLElement>('.header-cell');
      if (!headerCell) return;

      event.preventDefault();
      event.stopPropagation();

      const startX = (event as MouseEvent).clientX;
      const startWidth = headerCell.getBoundingClientRect().width;
      let lastWidth = startWidth;

      const handleMove = (moveEvent: MouseEvent): void => {
        lastWidth = Math.max(88, startWidth + (moveEvent.clientX - startX));

        // Write directly to DOM — skip full refresh while dragging.
        const newTemplate = this.controller!.buildTemplateColumnsWithOverride(
          columnName,
          lastWidth,
        );
        const root = this.shadowRoot ?? this;
        (root as ShadowRoot | HTMLElement)
          .querySelectorAll<HTMLElement>('.header-grid, .filter-grid, .body-grid')
          .forEach((el) => {
            el.style.gridTemplateColumns = newTemplate;
          });
      };

      const handleUp = (): void => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        // Commit final width once — triggers one full refresh.
        this.controller!.setColumnWidthOverride(columnName, lastWidth);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    });

    root.addEventListener('dblclick', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !this.controller) {
        return;
      }

      const resizer = target.closest<HTMLElement>('.column-resizer[data-column]');
      if (resizer && this.controller.canResizeColumns()) {
        const columnName = resizer.dataset['column'];
        if (columnName) {
          event.preventDefault();
          event.stopPropagation();
          this.controller.setColumnWidthOverride(
            columnName,
            this.measureAutoColumnWidth(columnName),
          );
          return;
        }
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

      // cellNav.keyDownOverrides: when a declared override matches this
      // keydown, skip cellnav's default handling and raise viewPortKeyDown
      // so the consumer can handle the key. Matches the old grid's
      // behaviour where consumers could surgically disable built-in key
      // handling per-key.
      const overrides = this.controller.getOptions().keyDownOverrides ?? [];
      if (overrides.length && target.closest('.body-cell')) {
        for (const override of overrides) {
          if (this.matchesKeyOverride(override, keyboardEvent)) {
            this.controller.raiseCellNavKeyEvent('keydown', keyboardEvent);
            return;
          }
        }
      }

      // Ctrl/Cmd+A on a body cell — select all rows in the grid. Matches
      // the old selection module's keyboard affordance. Safely gated by
      // enableRowSelection + multiSelect.
      if (
        (keyboardEvent.ctrlKey || keyboardEvent.metaKey) &&
        (keyboardEvent.key === 'a' || keyboardEvent.key === 'A') &&
        target.closest('.body-cell')
      ) {
        const resolved = this.controller.getResolvedSelectionOptions();
        if (resolved.enableRowSelection && resolved.multiSelect) {
          event.preventDefault();
          this.controller.selectAllRows(event);
          return;
        }
      }

      // Space on the row-header checkbox column toggles the row. Matches
      // the old selection module's cellNav-integrated Space handler. We
      // also allow Space on the focused cell row when full-row selection
      // is enabled, since the old "full row selection" mode let the user
      // drive selection without a checkbox column.
      if (keyboardEvent.key === ' ' || keyboardEvent.key === 'Spacebar') {
        const cell = target.closest<HTMLElement>('.body-cell[data-row][data-column]');
        const rowId = cell?.dataset['row'];
        const columnName = cell?.dataset['column'];
        if (cell && rowId && columnName) {
          const resolved = this.controller.getResolvedSelectionOptions();
          if (resolved.enableRowSelection) {
            const onCheckboxCol = columnName === 'selectionRowHeaderCol';
            if (onCheckboxCol || resolved.enableFullRowSelection) {
              event.preventDefault();
              const row = this.controller.findRowByIdPublic(rowId);
              if (row) {
                if (resolved.multiSelect && !resolved.modifierKeysToMultiSelect) {
                  this.controller.toggleRowSelectionByEntity(row.entity, event);
                } else {
                  this.controller.setMultiSelect(false);
                  this.controller.toggleRowSelectionByEntity(row.entity, event);
                  this.controller.setMultiSelect(resolved.multiSelect);
                }
              }
              return;
            }
          }
        }
      }

      if (target instanceof HTMLInputElement && target.dataset['role'] === 'editor') {
        if (keyboardEvent.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          const fromRow = target.dataset['row'] ?? null;
          const fromCol = target.dataset['column'] ?? null;
          const direction = keyboardEvent.shiftKey ? 'up' : 'down';
          this.commitAndMove(fromRow, fromCol, direction);
          return;
        }

        if (keyboardEvent.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          const fromRow = target.dataset['row'] ?? null;
          const fromCol = target.dataset['column'] ?? null;
          this.controller.cancelCellEdit();
          this.focusCellElement(fromRow, fromCol);
          return;
        }

        if (keyboardEvent.key === 'Tab') {
          event.preventDefault();
          event.stopPropagation();
          const fromRow = target.dataset['row'] ?? null;
          const fromCol = target.dataset['column'] ?? null;
          const direction = keyboardEvent.shiftKey ? 'left' : 'right';
          this.commitAndMove(fromRow, fromCol, direction);
          return;
        }

        return;
      }

      // Derive the logical cell either from the event target (clicked cell) or
      // from our tracked focusedCell state (covers the case where the browser
      // routed the event to the scroll container instead of the cell).
      let rowId: string | undefined;
      let columnName: string | undefined;
      const cell = target.closest<HTMLElement>('.body-cell');
      if (cell) {
        rowId = cell.dataset['row'];
        columnName = cell.dataset['column'];
      } else if (this.focusedCell) {
        rowId = this.focusedCell.rowId;
        columnName = this.focusedCell.columnName;
      }
      if (!rowId || !columnName) {
        return;
      }

      switch (keyboardEvent.key) {
        case 'ArrowLeft':
          event.preventDefault();
          this.moveGridFocus('left', rowId, columnName);
          return;
        case 'ArrowRight':
          event.preventDefault();
          this.moveGridFocus('right', rowId, columnName);
          return;
        case 'ArrowUp':
          event.preventDefault();
          this.moveGridFocus('up', rowId, columnName);
          return;
        case 'ArrowDown':
          event.preventDefault();
          this.moveGridFocus('down', rowId, columnName);
          return;
        case 'Tab':
          event.preventDefault();
          this.moveGridFocus(keyboardEvent.shiftKey ? 'left' : 'right', rowId, columnName);
          return;
        case 'Home':
          event.preventDefault();
          this.moveGridFocus(keyboardEvent.ctrlKey ? 'top' : 'rowStart', rowId, columnName);
          return;
        case 'End':
          event.preventDefault();
          this.moveGridFocus(keyboardEvent.ctrlKey ? 'bottom' : 'rowEnd', rowId, columnName);
          return;
        case 'Enter':
        case 'F2':
          event.preventDefault();
          this.controller.beginCellEdit(rowId, columnName, event);
          return;
        default:
          break;
      }

      if (
        keyboardEvent.key.length === 1 &&
        !keyboardEvent.ctrlKey &&
        !keyboardEvent.metaKey &&
        !keyboardEvent.altKey
      ) {
        event.preventDefault();
        // Pass the typed character as the initial value — beginCellEdit seeds
        // the editor with this instead of the cell's current value, so the
        // first keystroke isn't lost to the "input is focused, skip value
        // overwrite" guard in ui-grid-cell-editor.
        this.controller.beginCellEdit(rowId, columnName, event, keyboardEvent.key);
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
        root.querySelectorAll('.header-cell.is-drag-target').forEach((element) => {
          element.classList.remove('is-drag-target');
        });
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
        .forEach((element) => {
          element.classList.remove('is-dragging', 'is-drag-target');
        });

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
        .forEach((element) => {
          element.classList.remove('is-dragging', 'is-drag-target');
        });
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

        const snapshot = this.snapshot;
        if (!snapshot) return;

        if (snapshot.pipeline.virtualizationEnabled) {
          const stickyChromeHeight =
            this.measuredHeaderStickyHeight + this.measuredFilterStickyHeight;
          const bodyScrollTop = Math.max(0, this.scrollPosition - stickyChromeHeight);
          const overscan = 4;
          const nextStartIndex = Math.max(
            0,
            Math.floor(bodyScrollTop / snapshot.rowSize) - overscan,
          );
          const startChanged = nextStartIndex !== this.lastVirtualStartIndex;

          if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
          this.scrollFrame = requestAnimationFrame(() => {
            this.scrollFrame = null;
            if (startChanged) this.renderVirtualBody();
            this.maybeTriggerInfiniteScroll();
          });
          return;
        }

        // Non-virtualized path: still evaluate infinite-scroll thresholds
        // so large static datasets can page in via needLoadMoreData.
        if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
        this.scrollFrame = requestAnimationFrame(() => {
          this.scrollFrame = null;
          this.maybeTriggerInfiniteScroll();
        });
      },
      true,
    );

    (root as ShadowRoot & { __uiGridBound?: boolean }).__uiGridBound = true;
  }

  /**
   * Ask the controller to evaluate whether the current scroll position
   * should request more data at the top or bottom — ports the old grid's
   * handleScroll → loadData check. The controller does the actual
   * needLoadMoreData / needLoadMoreDataTop raise.
   */
  private maybeTriggerInfiniteScroll(): void {
    const snapshot = this.snapshot;
    if (!snapshot || !this.controller) return;
    if (snapshot.options.enableInfiniteScroll === false) return;
    const gridTable = this.shadowRoot?.querySelector<HTMLElement>('.grid-table');
    if (!gridTable) return;
    const stickyChromeHeight =
      this.measuredHeaderStickyHeight + this.measuredFilterStickyHeight;
    const rowSize = snapshot.rowSize || 1;
    const bodyScrollTop = Math.max(0, this.scrollPosition - stickyChromeHeight);
    const startIndex = Math.floor(bodyScrollTop / rowSize);
    const viewportRows = Math.max(
      1,
      Math.floor(Math.max(0, gridTable.clientHeight - stickyChromeHeight) / rowSize),
    );
    const visibleRows = snapshot.pipeline.visibleRows.length;
    this.controller.evaluateInfiniteScroll(startIndex, visibleRows, viewportRows);
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
    // The body fingerprint now reflects the freshly-rendered slice so the
    // next full render() can take the fast per-cell patch path.
    this.lastItemsFingerprint = this.fingerprintItems(itemsToRender);
    this.lastVirtualOffset = virtualOffset;
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
      this.lastStructureKey = null;
      this.lastItemsFingerprint = null;
      emptyTemplate({ message: 'No grid options provided.' }).connect(root);
      return;
    }

    const plan = this.buildRenderPlan(snapshot);

    // The shadow-DOM structure is only safe to patch when the set of sub-regions,
    // the visible column identity/order, and the pin/virt/filter/pagination
    // toggles are unchanged. Otherwise the existing nodes don't line up with the
    // new snapshot — fall back to a full re-mount.
    const canPatch =
      this.lastStructureKey !== null &&
      this.lastStructureKey === plan.structureKey &&
      root.querySelector('.grid-frame') !== null;

    if (canPatch) {
      this.renderPatch(plan, root);
    } else {
      this.renderFull(plan, root);
    }
    this.lastStructureKey = plan.structureKey;

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

  private buildRenderPlan(snapshot: GridControllerSnapshot): {
    snapshot: GridControllerSnapshot;
    options: GridOptions;
    labels: GridControllerSnapshot['labels'];
    templateColumns: string;
    sortEnabled: boolean;
    filterEnabled: boolean;
    groupingEnabled: boolean;
    pinningEnabled: boolean;
    paginationEnabled: boolean;
    showPagination: boolean;
    virtualizationEnabled: boolean;
    viewportHeight: number;
    headerStickyTop: number;
    hasViewportScroll: boolean;
    itemsToRender: readonly DisplayItem[];
    startIndex: number;
    virtualOffset: number;
    totalVirtualHeight: number;
    structureKey: string;
  } {
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
    const hasViewportScroll = virtualizationEnabled || options.viewportHeight !== undefined;

    let startIndex = 0;
    let itemsToRender: readonly DisplayItem[] = snapshot.pipeline.displayItems;
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

    // Structure key: only the outer-shell layout. Things that swap the body
    // container (virtualization flip, empty state, viewport scroll) or the
    // pagination element appearance are handled *inside* the patch path so a
    // filter keystroke that crosses the virtualization threshold doesn't
    // tear down the focused filter input.
    const columnFingerprint = snapshot.visibleColumns
      .map(
        (c) =>
          `${c.name}:${controller.isPinned(c) ? 'p' : ''}${controller.isPinnedLeftLast(c) ? 'L' : ''}${controller.isPinnedRightFirst(c) ? 'R' : ''}`,
      )
      .join('|');
    const structureKey = [
      columnFingerprint,
      filterEnabled ? '1' : '0',
      paginationEnabled ? '1' : '0',
    ].join('#');

    return {
      snapshot,
      options,
      labels,
      templateColumns,
      sortEnabled,
      filterEnabled,
      groupingEnabled,
      pinningEnabled,
      paginationEnabled,
      showPagination,
      virtualizationEnabled,
      viewportHeight,
      headerStickyTop,
      hasViewportScroll,
      itemsToRender,
      startIndex,
      virtualOffset,
      totalVirtualHeight,
      structureKey,
    };
  }

  private renderFull(
    plan: ReturnType<UiGridStandaloneElement['buildRenderPlan']>,
    _root: ShadowRoot,
  ): void {
    const {
      snapshot,
      options,
      labels,
      templateColumns,
      sortEnabled,
      filterEnabled,
      groupingEnabled,
      pinningEnabled,
      paginationEnabled,
      showPagination,
      virtualizationEnabled,
      viewportHeight,
      headerStickyTop,
      hasViewportScroll,
      itemsToRender,
      startIndex,
      virtualOffset,
      totalVirtualHeight,
    } = plan;

    const slotRegistry = this.renderSlotRegistry(snapshot.visibleColumns);
    const header = snapshot.visibleColumns
      .map((column) =>
        this.renderHeaderCell(column, sortEnabled, groupingEnabled, pinningEnabled, options),
      )
      .join('');

    const filterRow = filterEnabled
      ? filterRowMarkup(
          templateColumns,
          snapshot.visibleColumns.map((column) => this.renderFilterCell(column)).join(''),
        )
      : '';

    const bodyContent = itemsToRender
      .map((item, index) => this.renderDisplayItem(item, startIndex + index))
      .join('');

    const body =
      snapshot.pipeline.displayItems.length > 0
        ? virtualizationEnabled
          ? bodyVirtualMarkup(templateColumns, totalVirtualHeight, virtualOffset, bodyContent)
          : bodyStaticMarkup(templateColumns, bodyContent)
        : emptyDataMarkup(
            escapeHtml(options.emptyMessage ?? labels.emptyHeading),
            escapeHtml(labels.emptyDescription),
          );

    const pagination = paginationEnabled && showPagination ? this.renderPagination(snapshot) : '';

    this.gridTitle = escapeHtml(options.title ?? 'Data grid');
    this.gridTableStyle = `${hasViewportScroll ? `height:${viewportHeight}px;overflow-y:auto;` : ''}--ui-grid-header-sticky-top:${headerStickyTop}px;`;
    this.templateColumns = templateColumns;
    this.slotRegistry = slotRegistry;
    this.headerContent = header;
    this.filterRowContent = filterRow;
    this.bodyContent = body;
    this.paginationContent = pagination;

    gridShellTemplate(this).connect();

    // After a full mount, the new DOM exactly matches the current item set —
    // seed the fingerprint so the next render can take the fast patch path.
    this.lastItemsFingerprint = this.fingerprintItems(plan.itemsToRender);
    this.lastVirtualOffset = plan.virtualOffset;
    this.lastTotalVirtualHeight = plan.totalVirtualHeight;
  }

  private renderPatch(
    plan: ReturnType<UiGridStandaloneElement['buildRenderPlan']>,
    root: ShadowRoot,
  ): void {
    const {
      snapshot,
      options,
      labels,
      templateColumns,
      sortEnabled,
      filterEnabled,
      groupingEnabled,
      pinningEnabled,
      paginationEnabled,
      showPagination,
      virtualizationEnabled,
      viewportHeight,
      headerStickyTop,
      hasViewportScroll,
      itemsToRender,
      startIndex,
      virtualOffset,
      totalVirtualHeight,
    } = plan;

    // Grid frame aria-label.
    const gridFrame = root.querySelector<HTMLElement>('.grid-frame');
    const nextTitle = escapeHtml(options.title ?? 'Data grid');
    if (gridFrame && gridFrame.getAttribute('aria-label') !== nextTitle) {
      gridFrame.setAttribute('aria-label', nextTitle);
    }

    // Grid table wrapper styles (viewport height + sticky offset).
    const gridTable = root.querySelector<HTMLElement>('.grid-table');
    const nextTableStyle = `${hasViewportScroll ? `height:${viewportHeight}px;overflow-y:auto;` : ''}--ui-grid-header-sticky-top:${headerStickyTop}px;`;
    if (gridTable && gridTable.getAttribute('style') !== nextTableStyle) {
      gridTable.setAttribute('style', nextTableStyle);
    }

    // Header grid: track sizes + cells.
    const headerGrid = root.querySelector<HTMLElement>('.header-grid');
    if (headerGrid) {
      const nextHeaderStyle = `grid-template-columns:${templateColumns}`;
      if (headerGrid.getAttribute('style') !== nextHeaderStyle) {
        headerGrid.setAttribute('style', nextHeaderStyle);
      }
      const headerHtml = snapshot.visibleColumns
        .map((column) =>
          this.renderHeaderCell(column, sortEnabled, groupingEnabled, pinningEnabled, options),
        )
        .join('');
      if (headerGrid.innerHTML !== headerHtml) {
        headerGrid.innerHTML = headerHtml;
      }
    }

    // Filter row: update attributes on existing <ui-grid-filter-cell> elements
    // (keyed by data-column). This is the path that preserves input focus.
    if (filterEnabled) {
      const filterGrid = root.querySelector<HTMLElement>('.filter-grid');
      if (filterGrid) {
        const nextFilterStyle = `grid-template-columns:${templateColumns}`;
        if (filterGrid.getAttribute('style') !== nextFilterStyle) {
          filterGrid.setAttribute('style', nextFilterStyle);
        }
        this.patchFilterCells(filterGrid, snapshot);
      }
    }

    // Body region: innerHTML-swap just the grid rows. The scroll container
    // (.grid-table) is never replaced, so scroll position survives naturally.
    this.patchBodyRegion(
      root,
      snapshot,
      options,
      labels,
      templateColumns,
      virtualizationEnabled,
      itemsToRender,
      startIndex,
      virtualOffset,
      totalVirtualHeight,
    );

    // Pagination: show/hide + patch attributes. The element lives under
    // .grid-frame as a direct child (sibling of .grid-table), so toggling
    // its presence doesn't touch the filter input.
    this.reconcilePagination(root, snapshot, paginationEnabled && showPagination);
  }

  /**
   * Ensures the grid-table contains the right body node for the desired kind
   * (empty-state / virtual / static), reusing the existing node where possible.
   * Returns the body container the caller should patch into (the .body-grid
   * or .grid-virtual-body), or null for the empty state.
   */
  private reconcileBodyRoot(
    root: ShadowRoot,
    kind: 'empty' | 'virtual' | 'static',
    options: GridOptions,
    labels: GridControllerSnapshot['labels'],
    templateColumns: string,
    virtualOffset: number,
    totalVirtualHeight: number,
  ): HTMLElement | null {
    const gridTable = root.querySelector<HTMLElement>('.grid-table');
    if (!gridTable) return null;

    const currentEmpty = gridTable.querySelector<HTMLElement>(':scope > .empty-state');
    const currentVirtual = gridTable.querySelector<HTMLElement>(':scope > .grid-virtual-spacer');
    const currentStatic = gridTable.querySelector<HTMLElement>(':scope > .body-grid');
    const currentNode = currentEmpty ?? currentVirtual ?? currentStatic;

    if (kind === 'empty') {
      const heading = escapeHtml(options.emptyMessage ?? labels.emptyHeading);
      const description = escapeHtml(labels.emptyDescription);
      if (currentEmpty) {
        const strong = currentEmpty.querySelector('strong');
        const p = currentEmpty.querySelector('p');
        if (strong && strong.innerHTML !== heading) strong.innerHTML = heading;
        if (p && p.innerHTML !== description) p.innerHTML = description;
        return null;
      }
      const fresh = this.createFromMarkup(emptyDataMarkup(heading, description));
      if (fresh) this.swapBodyChild(gridTable, currentNode, fresh);
      return null;
    }

    if (kind === 'virtual') {
      if (currentVirtual) {
        return currentVirtual.querySelector<HTMLElement>('.grid-virtual-body');
      }
      const fresh = this.createFromMarkup(
        bodyVirtualMarkup(templateColumns, totalVirtualHeight, virtualOffset, ''),
      );
      if (fresh) this.swapBodyChild(gridTable, currentNode, fresh);
      return fresh?.querySelector<HTMLElement>('.grid-virtual-body') ?? null;
    }

    // static
    if (currentStatic) return currentStatic;
    const fresh = this.createFromMarkup(bodyStaticMarkup(templateColumns, ''));
    if (fresh) this.swapBodyChild(gridTable, currentNode, fresh);
    return fresh;
  }

  private createFromMarkup(html: string): HTMLElement | null {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    return wrapper.firstElementChild as HTMLElement | null;
  }

  private swapBodyChild(
    gridTable: HTMLElement,
    current: HTMLElement | null,
    next: HTMLElement,
  ): void {
    if (current) {
      gridTable.replaceChild(next, current);
    } else {
      gridTable.appendChild(next);
    }
  }

  private reconcilePagination(
    root: ShadowRoot,
    snapshot: GridControllerSnapshot,
    shouldShow: boolean,
  ): void {
    const frame = root.querySelector<HTMLElement>('.grid-frame');
    if (!frame) return;
    const existing = frame.querySelector<HTMLElement>(':scope > ui-grid-pagination');

    if (!shouldShow) {
      if (existing) existing.remove();
      return;
    }

    if (existing) {
      this.patchPagination(existing, snapshot);
      return;
    }

    // Mount a fresh pagination element at the end of the grid-frame.
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.renderPagination(snapshot);
    const fresh = wrapper.firstElementChild as HTMLElement | null;
    if (fresh) {
      frame.appendChild(fresh);
    }
  }

  private patchFilterCells(filterGrid: HTMLElement, snapshot: GridControllerSnapshot): void {
    const controller = this.controller!;
    const existing = new Map<string, HTMLElement>();
    for (const el of filterGrid.querySelectorAll<HTMLElement>('ui-grid-filter-cell[data-column]')) {
      const column = el.dataset['column'];
      if (column) existing.set(column, el);
    }

    for (const column of snapshot.visibleColumns) {
      const el = existing.get(column.name);
      if (!el) continue;
      const value = snapshot.activeFilters[column.name] ?? '';
      const canFilter = controller.isColumnFilterable(column);
      const pinOffset = controller.isPinned(column) ? controller.pinnedOffset(column) : null;
      const stickyStyle = pinOffset ? `${pinOffset.side}:${pinOffset.offset};` : '';
      setAttr(el, 'data-value', value);
      setAttr(el, 'data-placeholder', controller.filterPlaceholder(column));
      setAttr(el, 'data-disabled', String(!canFilter));
      setAttr(el, 'data-pinned', String(controller.isPinned(column)));
      setAttr(el, 'data-pinned-left-last', String(controller.isPinnedLeftLast(column)));
      setAttr(el, 'data-pinned-right-first', String(controller.isPinnedRightFirst(column)));
      setAttr(el, 'data-sticky-style', stickyStyle);
    }
  }

  private patchBodyRegion(
    root: ShadowRoot,
    snapshot: GridControllerSnapshot,
    options: GridOptions,
    labels: GridControllerSnapshot['labels'],
    templateColumns: string,
    virtualizationEnabled: boolean,
    itemsToRender: readonly DisplayItem[],
    startIndex: number,
    virtualOffset: number,
    totalVirtualHeight: number,
  ): void {
    // Desired body kind: empty / virtual / static. The DOM may currently host
    // a different kind (e.g. switching from static → virtual when a data load
    // crosses the virtualization threshold, or from any → empty when a filter
    // returns zero rows). Reconcile the body-region node *without* touching
    // .header-grid or .filter-grid — that's what preserves focus inside the
    // filter input across row-set changes.
    const hasRows = snapshot.pipeline.displayItems.length > 0;
    const desiredKind: 'empty' | 'virtual' | 'static' = !hasRows
      ? 'empty'
      : virtualizationEnabled
        ? 'virtual'
        : 'static';

    const bodyContainer = this.reconcileBodyRoot(
      root,
      desiredKind,
      options,
      labels,
      templateColumns,
      virtualOffset,
      totalVirtualHeight,
    );

    if (!hasRows) {
      this.lastItemsFingerprint = '';
      return;
    }

    const itemsFingerprint = this.fingerprintItems(itemsToRender);

    if (virtualizationEnabled) {
      const spacer = root.querySelector<HTMLElement>('.grid-virtual-spacer');
      if (spacer && totalVirtualHeight !== this.lastTotalVirtualHeight) {
        spacer.setAttribute('style', `height:${totalVirtualHeight}px`);
        this.lastTotalVirtualHeight = totalVirtualHeight;
      }
      if (bodyContainer) {
        const nextBodyStyle = `grid-template-columns:${templateColumns};top:${virtualOffset}px`;
        if (bodyContainer.getAttribute('style') !== nextBodyStyle) {
          bodyContainer.setAttribute('style', nextBodyStyle);
          this.lastVirtualOffset = virtualOffset;
        }
      }
    } else if (bodyContainer) {
      const nextStyle = `grid-template-columns:${templateColumns}`;
      if (bodyContainer.getAttribute('style') !== nextStyle) {
        bodyContainer.setAttribute('style', nextStyle);
      }
    }

    if (!bodyContainer) {
      this.lastItemsFingerprint = itemsFingerprint;
      return;
    }

    // Fast path: item layout identical to last render — patch each existing
    // cell / group row in place. This preserves focus inside any mounted
    // <ui-grid-cell-editor>, and avoids parsing a fresh HTML string for every
    // keystroke / unrelated snapshot (extreme perf path).
    if (this.lastItemsFingerprint === itemsFingerprint) {
      this.patchExistingRows(bodyContainer, snapshot, itemsToRender, startIndex);
      return;
    }

    // Slow path: row set changed (paging, sort, group toggle, tree expand,
    // virtualization window scrolled). Swap innerHTML so all fragments rebuild.
    const bodyContent = itemsToRender
      .map((item, index) => this.renderDisplayItem(item, startIndex + index))
      .join('');
    if (bodyContainer.innerHTML !== bodyContent) {
      bodyContainer.innerHTML = bodyContent;
    }
    this.lastItemsFingerprint = itemsFingerprint;
  }

  private fingerprintItems(items: readonly DisplayItem[]): string {
    // Lean identifier — kind + id per index. If any row/group is
    // added/removed/reordered, the fingerprint shifts and we fall back to
    // the innerHTML path.
    const parts: string[] = [];
    for (const item of items) {
      if (item.kind === 'group') {
        parts.push(`g:${(item as GroupItem).id}`);
      } else if (item.kind === 'expandable') {
        parts.push(`e:${(item as DisplayItem & { row: GridRow }).row.id}`);
      } else if (isRowItem(item)) {
        parts.push(`r:${item.row.id}`);
      } else {
        parts.push('?');
      }
    }
    return parts.join('|');
  }

  private patchExistingRows(
    bodyContainer: HTMLElement,
    snapshot: GridControllerSnapshot,
    itemsToRender: readonly DisplayItem[],
    startIndex: number,
  ): void {
    const controller = this.controller!;
    const columns = snapshot.visibleColumns;

    // Build O(1) lookup maps from a single pass over bodyContainer.children.
    // This replaces the previous O(rows×cols) querySelector approach.
    const groupEls = new Map<string, HTMLElement>();
    const cellEls = new Map<string, Map<string, HTMLElement>>();
    const expandableEls: HTMLElement[] = [];
    for (let c = 0; c < bodyContainer.children.length; c++) {
      const el = bodyContainer.children[c] as HTMLElement;
      const tag = el.tagName;
      if (tag === 'UI-GRID-GROUP-ROW') {
        const id = el.dataset['group'];
        if (id) groupEls.set(id, el);
      } else if (tag === 'UI-GRID-BODY-CELL') {
        const rowId = el.dataset['row'];
        const colName = el.dataset['column'];
        if (rowId && colName) {
          let rowMap = cellEls.get(rowId);
          if (!rowMap) {
            rowMap = new Map<string, HTMLElement>();
            cellEls.set(rowId, rowMap);
          }
          rowMap.set(colName, el);
        }
      } else if (tag === 'DIV' && el.classList.contains('expandable-row')) {
        expandableEls.push(el);
      }
    }

    const templateMarkupMap = new Map<string, string | null>();
    for (const col of columns) {
      templateMarkupMap.set(col.name, this.getTemplateMarkup(this.cellSlotName(col)));
    }

    let expandableIndex = 0;
    for (let i = 0; i < itemsToRender.length; i++) {
      const item = itemsToRender[i]!;
      const displayIndex = startIndex + i;

      if (item.kind === 'group') {
        const group = asGroupItem(item);
        const el = groupEls.get(group.id);
        if (el) {
          this.patchGroupRow(el, group);
        }
        continue;
      }

      if (item.kind === 'expandable') {
        // Patch expandable rows so data changes are reflected even when the
        // fingerprint (which only tracks row identity) stays the same.
        const el = expandableEls[expandableIndex++];
        if (el) {
          const row = (item as DisplayItem & { row: GridRow }).row;
          const nextHtml = this.renderExpandableTemplate(row);
          if (el.innerHTML !== nextHtml) {
            el.innerHTML = nextHtml;
          }
        }
        continue;
      }

      if (!isRowItem(item)) {
        continue;
      }

      const row = item.row;
      const rowCells = cellEls.get(row.id);
      if (!rowCells) continue;
      for (const column of columns) {
        const cell = rowCells.get(column.name);
        if (!cell) continue;
        this.patchBodyCell(cell, row, column, displayIndex, templateMarkupMap);
      }
    }
  }

  private patchGroupRow(el: HTMLElement, group: GroupItem): void {
    const snapshot = this.snapshot!;
    const controller = this.controller!;
    const iconKey = group.collapsed ? 'groupCollapsed' : 'groupExpanded';
    const icon = this.resolveIcon(iconKey);
    setAttr(el, 'data-collapsed', group.collapsed ? 'true' : 'false');
    setAttr(el, 'data-field', group.field);
    setAttr(el, 'data-label', group.label);
    setAttr(el, 'data-count', String(group.count));
    setAttr(el, 'data-depth', String(group.depth));
    setAttr(el, 'data-disclosure-label', controller.groupDisclosureLabel(group));
    setAttr(el, 'data-icon-path', icon.path);
    setAttr(el, 'data-icon-view-box', icon.viewBox ?? '0 0 24 24');
    setAttr(el, 'data-rows-suffix', snapshot.labels.groupRowsSuffix);
  }

  private patchBodyCell(
    cell: HTMLElement,
    row: GridRow,
    column: GridColumnDef,
    displayIndex: number,
    templateMarkupMap: Map<string, string | null>,
  ): void {
    const controller = this.controller!;
    const rowId = row.id;
    const columnName = column.name;
    const editing = controller.isEditingCell(rowId, columnName);
    const isPinned = controller.isPinned(column);
    const pinOffset = isPinned ? controller.pinnedOffset(column) : null;
    const stickyStyle = pinOffset ? `${pinOffset.side}:${pinOffset.offset};` : '';
    const isFocused =
      this.focusedCell?.rowId === rowId && this.focusedCell.columnName === columnName;
    const isPinnedLeftLast = controller.isPinnedLeftLast(column);
    const isPinnedRightFirst = controller.isPinnedRightFirst(column);
    const isOdd = displayIndex % 2 !== 0;
    const align = column.align ?? '';

    const isRowSelected = this.snapshot?.selectedRowIds.has(rowId) ?? false;
    const isRowFocused = this.snapshot?.focusedRowId === rowId;
    // Visual state is written directly (className / style) since the
    // <ui-grid-body-cell> custom element no longer translates data-* into
    // visual state. data-* attrs still drive event delegation and CSS hooks.
    setClass(
      cell,
      bodyCellClass(
        isOdd,
        align,
        isPinned,
        isPinnedLeftLast,
        isPinnedRightFirst,
        isFocused,
        editing,
        isRowSelected,
        isRowFocused,
      ),
    );
    setStyle(cell, stickyStyle);
    setAttr(cell, 'data-odd', String(isOdd));
    setAttr(cell, 'data-align', align);
    setAttr(cell, 'data-pinned', String(isPinned));
    setAttr(cell, 'data-pinned-left-last', String(isPinnedLeftLast));
    setAttr(cell, 'data-pinned-right-first', String(isPinnedRightFirst));
    setAttr(cell, 'data-focused', String(isFocused));
    setAttr(cell, 'data-editing', String(editing));
    setAttr(cell, 'data-sticky-style', stickyStyle);

    const cellShell = cell.querySelector<HTMLElement>(':scope > .cell-shell');
    if (!cellShell) return;

    const indentStyle = `padding-inline-start:${controller.cellIndent(row, column)}`;
    if (cellShell.getAttribute('style') !== indentStyle) {
      cellShell.setAttribute('style', indentStyle);
    }

    if (editing) {
      // Preserve the mounted <ui-grid-cell-editor> if present — just patch its
      // data-value. This is the path that preserves input focus + caret
      // across every keystroke's snapshot rebroadcast.
      const editor = cellShell.querySelector<HTMLElement>('ui-grid-cell-editor');
      const cellContent = cellShell.querySelector<HTMLElement>(':scope > .cell-content');
      if (editor && cellContent) {
        setAttr(editor, 'data-row', rowId);
        setAttr(editor, 'data-column', columnName);
        setAttr(editor, 'data-type', controller.editorInputType(column));
        setAttr(editor, 'data-value', this.snapshot?.editingValue ?? '');
        return;
      }
      // Transitioned from non-editing → editing: mount editor once by
      // rebuilding the cell-shell contents (toggles + cell-content + editor).
      const editingShellHtml = this.renderCellShellContents(row, column, displayIndex, true);
      if (cellShell.innerHTML !== editingShellHtml) {
        cellShell.innerHTML = editingShellHtml;
      }
      return;
    }

    // Not editing: rebuild the cell-shell's inner contents. This covers toggle
    // buttons (tree/expandable) which can appear/disappear as expandable slots
    // or tree rows come and go. The guard below skips the DOM write when the
    // rendered string matches the current DOM — steady-state typing / paging /
    // data refresh inside the same row layout is a no-op.
    const nextInner = this.renderCellShellContents(
      row,
      column,
      displayIndex,
      false,
      templateMarkupMap,
    );
    if (cellShell.innerHTML !== nextInner) {
      cellShell.innerHTML = nextInner;
    }
  }

  private renderCellShellContents(
    row: GridRow,
    column: GridColumnDef,
    displayIndex: number,
    editing: boolean,
    templateMarkupMap?: Map<string, string | null>,
  ): string {
    const controller = this.controller!;
    const rowId = row.id;
    const columnName = column.name;
    const treeToggle = controller.showTreeToggle(row, column)
      ? (() => {
          const treeIconKey = controller.isTreeRowExpanded(row) ? 'treeExpanded' : 'treeCollapsed';
          const treeIcon = this.resolveIcon(treeIconKey);
          return treeToggleMarkup(
            escapeHtml(rowId),
            escapeHtml(controller.treeToggleLabel(row)),
            treeIcon.viewBox ?? '0 0 24 24',
            treeIcon.path,
          );
        })()
      : '';
    const expandToggle = controller.showExpandToggle(row, column)
      ? (() => {
          const expIconKey = row.expanded ? 'expandExpanded' : 'expandCollapsed';
          const expIcon = this.resolveIcon(expIconKey);
          return expandToggleMarkup(
            escapeHtml(rowId),
            escapeHtml(controller.expandToggleLabel(row)),
            expIcon.viewBox ?? '0 0 24 24',
            expIcon.path,
          );
        })()
      : '';
    const content = editing
      ? cellEditorMarkup(
          escapeHtml(rowId),
          escapeHtml(columnName),
          escapeHtml(controller.editorInputType(column)),
          escapeHtml(this.snapshot?.editingValue ?? ''),
        )
      : templateMarkupMap
        ? this.renderCellTemplateFromMarkup(
            row,
            column,
            displayIndex,
            templateMarkupMap.get(columnName) ?? null,
          )
        : this.renderCellTemplate(row, column, displayIndex);
    return `${treeToggle}${expandToggle}<div class="cell-content">${content}</div>`;
  }

  private patchPagination(paginationEl: HTMLElement, snapshot: GridControllerSnapshot): void {
    const pageSizes = snapshot.options.paginationPageSizes ?? [10, 25, 50, 100];
    const prevIcon = this.resolveIcon('paginationPrev');
    const nextIcon = this.resolveIcon('paginationNext');
    setAttr(
      paginationEl,
      'data-range-label',
      `${snapshot.firstRowIndex + 1}-${snapshot.lastRowIndex + 1} of ${snapshot.pipeline.totalItems}`,
    );
    setAttr(paginationEl, 'data-current-page', String(snapshot.currentPage));
    setAttr(paginationEl, 'data-total-pages', String(snapshot.totalPages));
    setAttr(paginationEl, 'data-page-label', snapshot.labels.paginationPage);
    setAttr(paginationEl, 'data-of-label', snapshot.labels.paginationOf);
    setAttr(paginationEl, 'data-prev-label', snapshot.labels.paginationPrevious);
    setAttr(paginationEl, 'data-next-label', snapshot.labels.paginationNext);
    setAttr(paginationEl, 'data-rows-label', snapshot.labels.paginationRows);
    setAttr(paginationEl, 'data-prev-icon-path', prevIcon.path);
    setAttr(paginationEl, 'data-prev-icon-view-box', prevIcon.viewBox ?? '0 0 24 24');
    setAttr(paginationEl, 'data-next-icon-path', nextIcon.path);
    setAttr(paginationEl, 'data-next-icon-view-box', nextIcon.viewBox ?? '0 0 24 24');
    setAttr(paginationEl, 'data-page-sizes', JSON.stringify(pageSizes));
    setAttr(paginationEl, 'data-page-size', String(snapshot.pageSize));
    setAttr(paginationEl, 'data-prev-disabled', String(snapshot.currentPage <= 1));
    setAttr(
      paginationEl,
      'data-next-disabled',
      String(snapshot.currentPage >= snapshot.totalPages),
    );
  }

  private renderHeaderCell(
    column: GridColumnDef,
    sortEnabled: boolean,
    groupingEnabled: boolean,
    pinningEnabled: boolean,
    options: GridOptions,
  ): string {
    const controller = this.controller!;
    // Row-header selection column — emit a select-all checkbox instead of
    // the normal column header controls.
    if (column.name === 'selectionRowHeaderCol') {
      const resolvedSel = controller.getResolvedSelectionOptions();
      const selectAll = this.snapshot?.selectAll === true;
      const showSelectAll = resolvedSel.enableSelectAll && resolvedSel.multiSelect;
      const inner = showSelectAll
        ? `<button type="button" class="ui-grid-selection-select-all" data-action="select-all" aria-label="Select all rows"${selectAll ? ' aria-checked="true"' : ' aria-checked="false"'}><span class="ui-grid-selection-checkbox${selectAll ? ' ui-grid-selection-checkbox-checked' : ''}"></span></button>`
        : '';
      return `<ui-grid-header-cell class="header-cell ui-grid-selection-row-header" data-column="selectionRowHeaderCol">${inner}</ui-grid-header-cell>`;
    }
    const sortDirection = controller.getSortDirection(column);
    const sortLabel = controller.sortButtonLabel(column);
    const groupingLabel = controller.groupingButtonLabel(column);
    const canSort = sortEnabled && controller.isColumnSortable(column);
    const canGroup = groupingEnabled && column.enableGrouping !== false;
    const canPin = pinningEnabled && controller.isColumnPinnable(column);
    const isPinned = controller.isPinned(column);
    const pinOffset = isPinned ? controller.pinnedOffset(column) : null;
    const stickyStyle = pinOffset ? `${pinOffset.side}:${pinOffset.offset};` : '';

    const sortIconKey =
      sortDirection === SORT_DIRECTIONS.asc
        ? 'sortAsc'
        : sortDirection === SORT_DIRECTIONS.desc
          ? 'sortDesc'
          : 'sortNone';

    const pinLabel = isPinned
      ? (this.snapshot?.labels.unpin ?? 'Unpin')
      : (this.snapshot?.labels.pinColumn ?? 'Pin');
    const canResize = controller.canResizeColumns();
    const headerValue = escapeHtml(formatGridHeaderDisplayValue(buildGridHeaderContext(column)));
    const resizerHtml = canResize
      ? resizerMarkup(escapeHtml(column.name), escapeHtml(headerValue))
      : '';

    const isPinnedLeftLast = controller.isPinnedLeftLast(column);
    const isPinnedRightFirst = controller.isPinnedRightFirst(column);
    const isPinMenuOpen = this.openPinMenuColumn === column.name;
    const isDragTarget = this.dropTargetColumnName === column.name;
    const isDragging = this.draggedColumnName === column.name;
    const isDraggable = canGridMoveColumns(options);
    const className = headerCellClass(
      sortDirection !== SORT_DIRECTIONS.none,
      isPinned,
      isPinnedLeftLast,
      isPinnedRightFirst,
      isPinMenuOpen,
      isDragTarget,
      isDragging,
    );
    // className/style/draggable are pre-computed here so the <ui-grid-header-cell>
    // upgrade is a no-op at parse time. `data-*` stay for event delegation.
    return `<ui-grid-header-cell class="${className}"${isDraggable ? ' draggable="true"' : ''}${stickyStyle ? ` style="${escapeHtml(stickyStyle)}"` : ''} data-column="${escapeHtml(column.name)}" data-sort-active="${sortDirection !== SORT_DIRECTIONS.none}" data-pinned="${isPinned}" data-pinned-left-last="${isPinnedLeftLast}" data-pinned-right-first="${isPinnedRightFirst}" data-pin-menu-open="${isPinMenuOpen}" data-drag-target="${isDragTarget}" data-dragging="${isDragging}" data-draggable="${isDraggable}" data-sticky-style="${escapeHtml(stickyStyle)}"><span class="header-label">${headerValue}</span><span class="header-actions">${sortEnabled ? `<button type="button" class="header-action" data-action="sort" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(sortLabel)}" ${canSort ? '' : 'disabled'}>${this.renderControlIcon(sortIconKey)}<span class="sr-only">${escapeHtml(sortLabel)}</span></button>` : ''}${groupingEnabled ? `<button type="button" class="chip-action${controller.isColumnGrouped(column) ? ' chip-action-active' : ''}" data-action="group" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(groupingLabel)}" ${canGroup ? '' : 'disabled'}>${this.renderControlIcon('group')}<span class="sr-only">${escapeHtml(groupingLabel)}</span></button>` : ''}${canPin ? `<div class="pin-control${isPinMenuOpen ? ' pin-control-open' : ''}"><button type="button" class="chip-action pin-trigger${isPinned ? ' chip-action-active' : ''}" data-action="pin-trigger" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(pinLabel)}">${this.renderControlIcon('pin')}<span class="sr-only">${escapeHtml(pinLabel)}</span></button><div class="pin-menu" role="menu" aria-label="${escapeHtml(pinLabel)}"><button type="button" class="pin-menu-action" data-action="pin-left" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(this.snapshot?.labels.pinLeft ?? 'Pin left')}">${this.renderIconWithClass('control-icon', 'pinLeft')}<span class="sr-only">${escapeHtml(this.snapshot?.labels.pinLeft ?? 'Pin left')}</span></button><button type="button" class="pin-menu-action" data-action="pin-right" data-column="${escapeHtml(column.name)}" aria-label="${escapeHtml(this.snapshot?.labels.pinRight ?? 'Pin right')}">${this.renderIconWithClass('control-icon', 'pinRight')}<span class="sr-only">${escapeHtml(this.snapshot?.labels.pinRight ?? 'Pin right')}</span></button></div></div>` : ''}</span>${resizerHtml}</ui-grid-header-cell>`;
  }

  private renderFilterCell(column: GridColumnDef): string {
    // The selection row-header column renders a plain spacer <div> instead
    // of a real filter-cell — matches the old grid, which used a dedicated
    // header template for that column and never emitted a ui-grid-filter
    // slot there. The spacer keeps the grid-template-columns track aligned
    // but carries none of the filter-cell chrome (no padding / border /
    // input).
    if (column.name === 'selectionRowHeaderCol') {
      const pinOffset = this.controller!.isPinned(column) ? this.controller!.pinnedOffset(column) : null;
      const stickyStyle = pinOffset ? `${pinOffset.side}:${pinOffset.offset};` : '';
      return `<div class="filter-cell ui-grid-selection-row-header" data-column="selectionRowHeaderCol"${stickyStyle ? ` style="${escapeHtml(stickyStyle)}"` : ''}></div>`;
    }
    const value = this.snapshot?.activeFilters[column.name] ?? '';
    const controller = this.controller!;
    const canFilter = controller.isColumnFilterable(column);
    const pinOffset = controller.isPinned(column) ? controller.pinnedOffset(column) : null;
    const stickyStyle = pinOffset ? `${pinOffset.side}:${pinOffset.offset};` : '';
    return `<ui-grid-filter-cell data-column="${escapeHtml(column.name)}" data-value="${escapeHtml(value)}" data-placeholder="${escapeHtml(controller.filterPlaceholder(column))}" data-disabled="${!canFilter}" data-pinned="${controller.isPinned(column)}" data-pinned-left-last="${controller.isPinnedLeftLast(column)}" data-pinned-right-first="${controller.isPinnedRightFirst(column)}" data-sticky-style="${escapeHtml(stickyStyle)}"></ui-grid-filter-cell>`;
  }

  /**
   * Commit the in-flight edit, then move keyboard focus relative to the
   * committed cell. Splits commit + focus across two paint frames: commit
   * runs synchronously (editor unmounts, cell re-renders with the new value),
   * then focus moves to the adjacent cell. Scheduling the focus in a
   * microtask avoids racing the blur handler's re-entry guard and ensures
   * the destination cell is fully reattached in the DOM.
   *
   * If the source cell was being edited, the destination cell enters edit
   * mode too (provided the destination column is editable). This keeps
   * Tab/Enter nav inside an edit session continuous — you keep editing as
   * you move. Arrow nav outside an edit session does NOT auto-enter edit.
   */
  private commitAndMove(
    fromRowId: string | null,
    fromColumnName: string | null,
    direction: 'left' | 'right' | 'up' | 'down',
  ): void {
    if (!this.controller || !fromRowId || !fromColumnName) return;
    this.controller.commitCellEdit();
    queueMicrotask(() => {
      this.moveGridFocus(direction, fromRowId, fromColumnName, { resumeEdit: true });
    });
  }

  /** Move focus relative to (rowId, columnName). Directions: 'left' | 'right' |
   * 'up' | 'down' wrap across rows / wrap inside the visible window;
   * 'rowStart' / 'rowEnd' jump to the first/last column of the same row;
   * 'top' / 'bottom' jump to the first/last visible row. */
  private moveGridFocus(
    direction: 'left' | 'right' | 'up' | 'down' | 'rowStart' | 'rowEnd' | 'top' | 'bottom',
    rowId: string | null,
    columnName: string | null,
    opts: { resumeEdit?: boolean } = {},
  ): void {
    if (!this.snapshot || !this.controller || !rowId || !columnName) return;
    // Use the display-items order (groups + expandables interleaved) so
    // ArrowDown advances to whatever row comes *visually* next — skipping
    // over group headers and expandable rows. pipeline.visibleRows is just
    // the raw row list ignoring grouping, which made nav jump past headers.
    const rows: GridRow[] = [];
    for (const item of this.snapshot.pipeline.displayItems) {
      if (isRowItem(item)) rows.push(item.row);
    }
    const columns = this.snapshot.visibleColumns;
    if (rows.length === 0 || columns.length === 0) return;

    let nextRowId = rowId;
    let nextColumnName = columnName;
    let nextRow: GridRow | undefined;
    let nextColumn: GridColumnDef | undefined;

    if (direction === 'top' || direction === 'bottom') {
      const row = rows[direction === 'top' ? 0 : rows.length - 1];
      if (!row) return;
      nextRow = row;
      nextColumn = columns.find((c) => c.name === columnName);
      nextRowId = row.id;
    } else if (direction === 'rowStart' || direction === 'rowEnd') {
      const col = columns[direction === 'rowStart' ? 0 : columns.length - 1];
      if (!col) return;
      nextColumn = col;
      nextRow = rows.find((r) => r.id === rowId);
      nextColumnName = col.name;
    } else {
      const next = findNextGridCell({
        rows,
        columns,
        rowId,
        columnName,
        direction,
      });
      if (!next) return;
      nextRow = next.row;
      nextColumn = next.column;
      nextRowId = next.row.id;
      nextColumnName = next.column.name;
    }

    const previous = this.focusedCell;
    this.focusedCell = { rowId: nextRowId, columnName: nextColumnName };
    // Move the `cell-focused` decoration immediately so the selection
    // indicator tracks keyboard nav even though we don't re-render the whole
    // grid on every arrow press. We only mutate the two affected cells.
    this.applyFocusedCellClass(previous, this.focusedCell);
    this.scrollFocusedRowIntoView(nextRowId);
    // Raise cellNav.navigate for consumers that wired a listener (ports the
    // old gridApi.cellNav.on.navigate event).
    this.controller.setCellNavFocus(nextRowId, nextColumnName);

    // When moving out of an edit session (Tab/Enter in editor), auto-open
    // the next cell's editor if that cell is editable. Non-edit nav (plain
    // arrow keys on a non-editing cell) never opens the editor.
    if (opts.resumeEdit && nextRow && nextColumn && this.controller.isCellEditable(nextRow, nextColumn)) {
      this.controller.beginCellEdit(nextRowId, nextColumnName);
      return;
    }

    this.focusCellElement(nextRowId, nextColumnName);
  }

  /**
   * Ensure the row for `rowId` is inside the virtualization window before
   * focus moves there. When virtualization is on, a distant row isn't yet
   * rendered into the DOM — we scroll to bring it in, let the virtual-body
   * rebuild on the next frame, then `focusCellElement`'s retry picks it up.
   */
  private scrollFocusedRowIntoView(rowId: string): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const index = snapshot.pipeline.displayItems.findIndex(
      (item) => 'row' in item && item.row && (item.row as { id: string }).id === rowId,
    );
    if (index < 0) return;
    const gridTable = this.shadowRoot?.querySelector<HTMLElement>('.grid-table');
    if (!gridTable) return;
    const stickyChromeHeight = this.measuredHeaderStickyHeight + this.measuredFilterStickyHeight;
    const rowTop = index * snapshot.rowSize;
    const rowBottom = rowTop + snapshot.rowSize;
    const viewportTop = gridTable.scrollTop;
    const viewportHeight = gridTable.clientHeight;
    const visibleTop = viewportTop + stickyChromeHeight;
    const visibleBottom = viewportTop + viewportHeight;
    if (rowTop < visibleTop) {
      gridTable.scrollTop = Math.max(0, rowTop - stickyChromeHeight);
    } else if (rowBottom > visibleBottom) {
      gridTable.scrollTop = rowBottom - viewportHeight;
    }
  }

  /**
   * Selection dispatch for a plain click on a body cell. Mirrors the old
   * ui.grid.selection.uiGridCell directive: shift-click = range, ctrl/meta
   * = toggle single, everything else toggles based on enableFullRowSelection
   * + enableSelectRowOnFocus + modifierKeysToMultiSelect.
   */
  private handleRowSelectionClick(
    rowId: string,
    columnName: string,
    event: Event,
  ): void {
    const controller = this.controller;
    if (!controller) return;
    const resolved = controller.getResolvedSelectionOptions();
    if (!resolved.enableRowSelection) return;
    // The checkbox column has its own click path.
    if (columnName === 'selectionRowHeaderCol') return;
    if (!resolved.enableFullRowSelection) {
      // Full-row selection is off — only the checkbox column selects, but
      // focus-row-changed should still fire.
      const row = controller.findRowByIdPublic(rowId);
      if (row) {
        controller.setRowFocused(rowId, true, event);
      }
      return;
    }
    const row = controller.findRowByIdPublic(rowId);
    if (!row) return;
    const mouseEvent = event as MouseEvent;
    if (mouseEvent.shiftKey) {
      controller.shiftSelectRow(row.entity, event);
    } else if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
      controller.toggleRowSelectionByEntity(row.entity, event);
    } else if (resolved.enableSelectRowOnFocus) {
      // Plain click. With modifierKeysToMultiSelect=true we fall back to
      // single-select mode (multiSelect=false) so the click replaces the
      // selection instead of adding to it.
      if (resolved.multiSelect && !resolved.modifierKeysToMultiSelect) {
        controller.toggleRowSelectionByEntity(row.entity, event);
      } else {
        // Single-select semantics: clear everything else first.
        // toggleGridRowSelection already handles this internally when
        // multiSelect=false, but we need to pass multiSelect=false through
        // the API. Emulate by temporarily calling with multiSelect logic.
        controller.setMultiSelect(false);
        controller.toggleRowSelectionByEntity(row.entity, event);
        controller.setMultiSelect(resolved.multiSelect);
      }
    }
    controller.setRowFocused(rowId, true, event);
  }

  /** Click on the row-header checkbox column. Differs from full-row click
   * only in that shift/ctrl semantics behave like the old selection module
   * (shift-select pulls from lastSelectedRow regardless of modifier). */
  private handleRowHeaderCheckboxClick(rowId: string, event: Event): void {
    const controller = this.controller;
    if (!controller) return;
    const resolved = controller.getResolvedSelectionOptions();
    if (!resolved.enableRowSelection) return;
    const row = controller.findRowByIdPublic(rowId);
    if (!row) return;
    const mouseEvent = event as MouseEvent;
    if (mouseEvent.shiftKey) {
      controller.shiftSelectRow(row.entity, event);
    } else if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
      controller.toggleRowSelectionByEntity(row.entity, event);
    } else {
      if (resolved.multiSelect && !resolved.modifierKeysToMultiSelect) {
        controller.toggleRowSelectionByEntity(row.entity, event);
      } else {
        controller.setMultiSelect(false);
        controller.toggleRowSelectionByEntity(row.entity, event);
        controller.setMultiSelect(resolved.multiSelect);
      }
    }
    if (resolved.enableFocusRowOnRowHeaderClick) {
      controller.setRowFocused(rowId, true, event);
    }
  }

  /** Does a keydown event match a cellNav key-override descriptor?
   * Undefined fields on the override are treated as wildcards. */
  private matchesKeyOverride(
    override: {
      keyCode?: number;
      key?: string;
      shiftKey?: boolean;
      ctrlKey?: boolean;
      altKey?: boolean;
      metaKey?: boolean;
    },
    event: KeyboardEvent,
  ): boolean {
    if (override.keyCode !== undefined && override.keyCode !== event.keyCode) return false;
    if (override.key !== undefined && override.key !== event.key) return false;
    if (override.shiftKey !== undefined && override.shiftKey !== event.shiftKey) return false;
    if (override.ctrlKey !== undefined && override.ctrlKey !== event.ctrlKey) return false;
    if (override.altKey !== undefined && override.altKey !== event.altKey) return false;
    if (override.metaKey !== undefined && override.metaKey !== event.metaKey) return false;
    return true;
  }

  private applyFocusedCellClass(
    previous: { rowId: string; columnName: string } | null,
    next: { rowId: string; columnName: string } | null,
  ): void {
    const root = this.shadowRoot;
    if (!root) return;
    if (previous && (previous.rowId !== next?.rowId || previous.columnName !== next?.columnName)) {
      const prevEl = root.querySelector<HTMLElement>(
        `.body-cell[data-row="${cssEscape(previous.rowId)}"][data-column="${cssEscape(previous.columnName)}"]`,
      );
      if (prevEl) {
        prevEl.classList.remove('cell-focused');
        prevEl.setAttribute('data-focused', 'false');
      }
    }
    if (next) {
      const nextEl = root.querySelector<HTMLElement>(
        `.body-cell[data-row="${cssEscape(next.rowId)}"][data-column="${cssEscape(next.columnName)}"]`,
      );
      if (nextEl) {
        nextEl.classList.add('cell-focused');
        nextEl.setAttribute('data-focused', 'true');
      }
    }
  }

  /** DOM-focus the body cell matching the given row/column. Uses the rendered
   * DOM directly (no framework-specific selector helper). Retries across
   * two animation frames — long enough for a scroll-triggered virtual body
   * rebuild to bring the target row into the DOM. */
  private focusCellElement(rowId: string | null, columnName: string | null): void {
    if (!rowId || !columnName) return;
    const root = this.shadowRoot;
    if (!root) return;
    const selector = `.body-cell[data-row="${cssEscape(rowId)}"][data-column="${cssEscape(columnName)}"]`;
    const attempt = (retriesLeft: number): void => {
      const el = root.querySelector<HTMLElement>(selector);
      if (!el) {
        if (retriesLeft > 0) requestAnimationFrame(() => attempt(retriesLeft - 1));
        return;
      }
      try {
        el.focus({ preventScroll: false });
      } catch {
        el.focus();
      }
    };
    attempt(2);
  }

  private measureAutoColumnWidth(columnName: string): number {
    const root = this.shadowRoot;
    if (root == null) return 176;
    const escaped = CSS.escape
      ? CSS.escape(columnName)
      : columnName.replace(/([\\".#:[\](){}+~> ])/g, '\\$1');
    const selectors = [
      `.header-cell[data-column="${escaped}"]`,
      `.filter-cell[data-column="${escaped}"]`,
      `.body-cell[data-column="${escaped}"] .cell-shell`,
    ];
    let maxWidth = 0;
    for (const selector of selectors) {
      for (const el of root.querySelectorAll<HTMLElement>(selector)) {
        maxWidth = Math.max(maxWidth, el.scrollWidth);
      }
    }
    return maxWidth + 12;
  }

  private renderDisplayItem(item: DisplayItem, displayIndex: number): string {
    if (!this.snapshot || !this.controller) {
      return '';
    }

    if (item.kind === 'group') {
      const group = asGroupItem(item);
      const iconKey = group.collapsed ? 'groupCollapsed' : 'groupExpanded';
      const icon = this.resolveIcon(iconKey);
      const disclosureLabel = this.controller.groupDisclosureLabel(group);
      return `<ui-grid-group-row data-action="toggle-group" data-group="${escapeHtml(group.id)}" data-collapsed="${group.collapsed ? 'true' : 'false'}" data-field="${escapeHtml(group.field)}" data-label="${escapeHtml(group.label)}" data-count="${group.count}" data-depth="${group.depth}" data-disclosure-label="${escapeHtml(disclosureLabel)}" data-icon-path="${icon.path}" data-icon-view-box="${icon.viewBox ?? '0 0 24 24'}" data-rows-suffix="${escapeHtml(this.snapshot.labels.groupRowsSuffix)}"></ui-grid-group-row>`;
    }

    if (item.kind === 'expandable') {
      const row = (item as DisplayItem & { row: GridRow }).row;
      return expandableRowMarkup(this.renderExpandableTemplate(row));
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
      ? (() => {
          const treeIconKey = controller.isTreeRowExpanded(row) ? 'treeExpanded' : 'treeCollapsed';
          const treeIcon = this.resolveIcon(treeIconKey);
          return treeToggleMarkup(
            escapeHtml(rowId),
            escapeHtml(controller.treeToggleLabel(row)),
            treeIcon.viewBox ?? '0 0 24 24',
            treeIcon.path,
          );
        })()
      : '';
    const expandToggle = controller.showExpandToggle(row, column)
      ? (() => {
          const expIconKey = row.expanded ? 'expandExpanded' : 'expandCollapsed';
          const expIcon = this.resolveIcon(expIconKey);
          return expandToggleMarkup(
            escapeHtml(rowId),
            escapeHtml(controller.expandToggleLabel(row)),
            expIcon.viewBox ?? '0 0 24 24',
            expIcon.path,
          );
        })()
      : '';

    const content = editing
      ? cellEditorMarkup(
          escapeHtml(rowId),
          escapeHtml(columnName),
          escapeHtml(controller.editorInputType(column)),
          escapeHtml(this.snapshot.editingValue),
        )
      : this.renderCellTemplate(row, column, displayIndex);

    const isFocused =
      this.focusedCell?.rowId === rowId && this.focusedCell.columnName === columnName;
    const stickyStyle = pinOffset ? `${pinOffset.side}:${pinOffset.offset};` : '';
    const isPinned = controller.isPinned(column);
    const isPinnedLeftLast = controller.isPinnedLeftLast(column);
    const isPinnedRightFirst = controller.isPinnedRightFirst(column);
    const align = column.align ?? '';
    const isRowSelected = this.snapshot?.selectedRowIds.has(rowId) ?? false;
    const isRowFocused = this.snapshot?.focusedRowId === rowId;
    const className = bodyCellClass(
      displayIndex % 2 !== 0,
      align,
      isPinned,
      isPinnedLeftLast,
      isPinnedRightFirst,
      isFocused,
      editing,
      isRowSelected,
      isRowFocused,
    );
    // className/style/tabindex are pre-computed here so the <ui-grid-body-cell>
    // upgrade is a no-op at parse time. `data-*` stay for event delegation.
    return `<ui-grid-body-cell class="${className}" tabindex="0"${stickyStyle ? ` style="${escapeHtml(stickyStyle)}"` : ''} data-row="${escapeHtml(rowId)}" data-column="${escapeHtml(columnName)}" data-odd="${displayIndex % 2 !== 0}" data-align="${escapeHtml(align)}" data-pinned="${isPinned}" data-pinned-left-last="${isPinnedLeftLast}" data-pinned-right-first="${isPinnedRightFirst}" data-focused="${isFocused}" data-editing="${editing}" data-sticky-style="${escapeHtml(stickyStyle)}"><div class="cell-shell" style="padding-inline-start:${escapeHtml(controller.cellIndent(row, column))}">${treeToggle}${expandToggle}<div class="cell-content">${content}</div></div></ui-grid-body-cell>`;
  }

  private renderPagination(snapshot: GridControllerSnapshot): string {
    const pageSizes = snapshot.options.paginationPageSizes ?? [10, 25, 50, 100];
    const prevIcon = this.resolveIcon('paginationPrev');
    const nextIcon = this.resolveIcon('paginationNext');
    return `<ui-grid-pagination data-range-label="${escapeHtml(`${snapshot.firstRowIndex + 1}-${snapshot.lastRowIndex + 1} of ${snapshot.pipeline.totalItems}`)}" data-current-page="${snapshot.currentPage}" data-total-pages="${snapshot.totalPages}" data-page-label="${escapeHtml(snapshot.labels.paginationPage)}" data-of-label="${escapeHtml(snapshot.labels.paginationOf)}" data-prev-label="${escapeHtml(snapshot.labels.paginationPrevious)}" data-next-label="${escapeHtml(snapshot.labels.paginationNext)}" data-rows-label="${escapeHtml(snapshot.labels.paginationRows)}" data-prev-icon-path="${prevIcon.path}" data-prev-icon-view-box="${prevIcon.viewBox ?? '0 0 24 24'}" data-next-icon-path="${nextIcon.path}" data-next-icon-view-box="${nextIcon.viewBox ?? '0 0 24 24'}" data-page-sizes="${escapeHtml(JSON.stringify(pageSizes))}" data-page-size="${snapshot.pageSize}" data-prev-disabled="${snapshot.currentPage <= 1}" data-next-disabled="${snapshot.currentPage >= snapshot.totalPages}"></ui-grid-pagination>`;
  }

  private renderSlotRegistry(columns: readonly GridColumnDef[]): string {
    const cellSlots = columns
      .map((column) => `<slot name="${escapeHtml(this.cellSlotName(column))}"></slot>`)
      .join('');
    return slotRegistryMarkup(cellSlots);
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
    // Special-case the selection row-header column — render a checkbox
    // whose checked state tracks the row's isSelected. Matches the old
    // selectionRowHeaderButtons template.
    if (column.name === 'selectionRowHeaderCol') {
      const checked = this.snapshot?.selectedRowIds.has(row.id) ?? false;
      const disabled = row.enableSelection === false;
      return `<span class="ui-grid-selection-row-header-buttons" role="checkbox" tabindex="-1"${checked ? ' aria-checked="true"' : ' aria-checked="false"'}${disabled ? ' aria-disabled="true"' : ''}><span class="ui-grid-selection-checkbox${checked ? ' ui-grid-selection-checkbox-checked' : ''}${disabled ? ' ui-grid-selection-checkbox-disabled' : ''}"></span></span>`;
    }
    if (!templateMarkup) {
      return cellValueMarkup(escapeHtml(this.controller?.displayValue(row, column) ?? ''));
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
      return defaultExpandableMarkup(escapeHtml(String(row.entity['name'] ?? row.id)));
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
    // Support both {{expression}} and ${expression} bindings
    return templateMarkup
      .replace(/{{\s*([^}]+?)\s*}}/g, (_match, expression) => {
        const value = this.resolveTemplateValue(context, String(expression).trim());
        return escapeHtml(value);
      })
      .replace(/\$\{(.+?)\}/g, (_match, expression) => {
        // Strip "this." or "props." prefix for consistency with @ornery/web-components
        const cleaned = String(expression)
          .trim()
          .replace(/^(this|props)\./, '');
        const value = this.resolveTemplateValue(context, cleaned);
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
      if (
        previousSnapshot.visibleColumns[index]?.name !== nextSnapshot.visibleColumns[index]?.name
      ) {
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
    const icon = this.resolveIcon(key);
    return iconMarkup(svgClass, icon.viewBox ?? '0 0 24 24', icon.path);
  }
}

export async function defineStandaloneUiGridElement(tagName = 'ui-grid-element'): Promise<void> {
  UIGridFilterCell.define();
  UIGridGroupRow.define();
  UIGridPagination.define();
  UIGridBodyCell.define();
  UIGridHeaderCell.define();
  UIGridTemplate.define();
  UIGridCellEditor.define();
  if (!customElements.get(tagName)) {
    customElements.define(tagName, UiGridStandaloneElement);
  }
}
