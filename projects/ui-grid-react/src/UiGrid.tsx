/**
 * React wrapper around `<ui-grid-element>` (the vanilla web component).
 *
 * This component mounts a single `<ui-grid-element>` in the DOM and bridges
 * the React idioms consumers expect:
 *
 *   - Declarative props map to the element's `options` setter + individual
 *     kebab-case HTML attributes.
 *   - Every `CustomEvent` the element dispatches is re-emitted as an `onXxx`
 *     prop (camelCase).
 *   - JSX render-prop templates (`cellRenderers`, `headerRenderers`,
 *     `filterRenderers`, `groupRowRenderer`, `expandableRenderer`,
 *     `emptyRenderer`) project into the element's shadow DOM via the
 *     framework-slot bridge: the element emits `<slot name="…">` placeholders,
 *     the wrapper portals React nodes into matching `<div slot="…">`
 *     elements in the element's light DOM, and slot projection composes them
 *     back into the shadow tree.
 *   - `onRegisterApi` is forwarded verbatim — consumers get the same
 *     `UiGridApi` the vanilla element produces.
 *
 * The old React renderer (the `useGridState` hook + its React-native DOM
 * scaffolding) has been removed. The wrapper now delegates 100% to the
 * vanilla web component, so every feature that ships in the element is
 * automatically available here.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import {
  defineStandaloneUiGridElement,
  type FrameworkCellSlot,
  type FrameworkEmptyStateSlot,
  type FrameworkExpandableRowSlot,
  type FrameworkFilterSlot,
  type FrameworkGroupRowSlot,
  type FrameworkHeaderSlot,
  type FrameworkRenderedSlotsConfig,
  type FrameworkSlotDelta,
  type UiGridStandaloneElement,
} from '@ornery/ui-grid-vanilla';
import type {
  GridCellTemplateContext,
  GridExpandableTemplateContext,
  GridHeaderTemplateContext,
  GridOptions,
  UiGridApi,
} from '@ornery/ui-grid-core';

// Triple-slash directive so the `ui-grid-element` JSX declaration is picked
// up by any file that imports `UiGrid`. See `./ui-grid-element.d.ts`.
/// <reference path="./ui-grid-element.d.ts" />

// The vanilla element is registered once per process. We kick off the
// registration at module scope so the first mount doesn't pay a setup cost.
void defineStandaloneUiGridElement();

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

/** Filter-cell context passed to `filterRenderers`. Consumers read the
 * current filter value + call `gridApi.core.setFilter` to apply changes. */
export interface UiGridFilterRendererContext {
  columnName: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  column: FrameworkFilterSlot['column'];
}

/** Group-row context passed to `groupRowRenderer`. */
export interface UiGridGroupRowRendererContext {
  groupId: string;
  field: string;
  label: string;
  count: number;
  depth: number;
  collapsed: boolean;
}

/** Empty-state context passed to `emptyRenderer`. */
export interface UiGridEmptyStateContext {
  heading: string;
  description: string;
}

export interface UiGridProps {
  /**
   * Full `GridOptions` object. Any field set here wins over the
   * corresponding individual prop below — use whichever style you prefer.
   */
  options?: GridOptions;

  /** Called once when the grid's `UiGridApi` is ready. */
  onRegisterApi?: (api: UiGridApi) => void;

  /** Extra class(es) to add to the host container. */
  className?: string;
  /** Inline style passthrough for the host container. */
  style?: React.CSSProperties;

  // ───────── Declarative attribute props (mirrors the vanilla surface) ─────────

  gridId?: string;
  title?: string;
  data?: GridOptions['data'];
  columnDefs?: GridOptions['columnDefs'];
  grouping?: GridOptions['grouping'];
  rowHeight?: number;
  headerRowHeight?: number;
  viewportHeight?: number;
  paginationPageSize?: number;
  paginationPageSizes?: number[] | null;
  paginationCurrentPage?: number;
  totalItems?: number;
  virtualizationThreshold?: number;
  treeChildrenField?: string;
  treeIndent?: number;
  expandableRowHeight?: number;
  expandableRowHeaderWidth?: number;
  emptyMessage?: string;
  infiniteScrollRowsFromEnd?: number;

  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableGrouping?: boolean;
  enablePinning?: boolean;
  enableColumnMoving?: boolean;
  enableColumnResizing?: boolean;
  enableCellEdit?: boolean;
  enableCellEditOnFocus?: boolean;
  enablePagination?: boolean;
  enablePaginationControls?: boolean;
  useExternalPagination?: boolean;
  enableExpandable?: boolean;
  enableTreeView?: boolean;
  showTreeExpandNoChildren?: boolean;
  treeRowHeaderAlwaysVisible?: boolean;
  enableAutoResize?: boolean;
  enableVirtualization?: boolean;
  enableInfiniteScroll?: boolean;
  infiniteScrollUp?: boolean;
  infiniteScrollDown?: boolean;

  // Selection ports.
  enableRowSelection?: boolean;
  multiSelect?: boolean;
  noUnselect?: boolean;
  modifierKeysToMultiSelect?: boolean;
  enableRowHeaderSelection?: boolean;
  enableFullRowSelection?: boolean;
  enableFocusRowOnRowHeaderClick?: boolean;
  enableSelectRowOnFocus?: boolean;
  enableSelectAll?: boolean;
  enableSelectionBatchEvent?: boolean;
  enableFooterTotalSelected?: boolean;
  selectionRowHeaderWidth?: number;

  // ───────── Template render-prop surface ─────────

  /**
   * Per-column cell renderers. Keys are column names. When a key matches a
   * column, that column's body cells are projected through this renderer.
   * Columns not in the map render via the usual vanilla path.
   */
  cellRenderers?: Record<string, (ctx: GridCellTemplateContext) => React.ReactNode>;

  /**
   * Fallback single renderer applied to every column that doesn't appear in
   * `cellRenderers`. Useful when you want the same React rendering for all
   * cells (e.g. wrap every value in a styled span).
   */
  cellRenderer?: (ctx: GridCellTemplateContext) => React.ReactNode;

  /** Per-column header renderers. */
  headerRenderers?: Record<string, (ctx: GridHeaderTemplateContext) => React.ReactNode>;

  /** Fallback single renderer applied to every column that doesn't appear in
   * `headerRenderers`. */
  headerRenderer?: (ctx: GridHeaderTemplateContext) => React.ReactNode;

  /**
   * Per-column filter renderers. The consumer owns the input element and
   * must call `gridApi.core.setFilter(columnName, value)` to apply changes.
   */
  filterRenderers?: Record<string, (ctx: UiGridFilterRendererContext) => React.ReactNode>;

  /** Single renderer applied to every group row. */
  groupRowRenderer?: (ctx: UiGridGroupRowRendererContext) => React.ReactNode;

  /** Single renderer for expandable detail rows. */
  expandableRenderer?: (ctx: GridExpandableTemplateContext) => React.ReactNode;

  /** Empty-state panel renderer. */
  emptyRenderer?: (ctx: UiGridEmptyStateContext) => React.ReactNode;

  // ───────── Event props ─────────

  onRowsVisibleChanged?: (event: CustomEvent) => void;
  onRowsRendered?: (event: CustomEvent) => void;
  onScrollBegin?: (event: CustomEvent) => void;
  onScrollEnd?: (event: CustomEvent) => void;
  onSortChanged?: (event: CustomEvent) => void;
  onFilterChanged?: (event: CustomEvent) => void;
  onGroupingChanged?: (event: CustomEvent) => void;
  onColumnOrderChanged?: (event: CustomEvent) => void;
  onColumnPinned?: (event: CustomEvent) => void;
  onRowSelectionChanged?: (event: CustomEvent) => void;
  onRowSelectionChangedBatch?: (event: CustomEvent) => void;
  onRowFocusChanged?: (event: CustomEvent) => void;
  onBeginCellEdit?: (event: CustomEvent) => void;
  onAfterCellEdit?: (event: CustomEvent) => void;
  onCancelCellEdit?: (event: CustomEvent) => void;
  onPaginationChanged?: (event: CustomEvent) => void;
  onNeedLoadMoreData?: (event: CustomEvent) => void;
  onNeedLoadMoreDataTop?: (event: CustomEvent) => void;
  onSaveRow?: (event: CustomEvent) => void;
  onValidationFailed?: (event: CustomEvent) => void;
  onLanguageChanged?: (event: CustomEvent) => void;
  onRenderingComplete?: (event: CustomEvent) => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/** Map of camelCase event prop → lowercase custom-event name. */
const EVENT_MAP: Record<string, string> = {
  onRowsVisibleChanged: 'rowsVisibleChanged',
  onRowsRendered: 'rowsRendered',
  onScrollBegin: 'scrollBegin',
  onScrollEnd: 'scrollEnd',
  onSortChanged: 'sortChanged',
  onFilterChanged: 'filterChanged',
  onGroupingChanged: 'groupingChanged',
  onColumnOrderChanged: 'columnOrderChanged',
  onColumnPinned: 'columnPinned',
  onRowSelectionChanged: 'rowSelectionChanged',
  onRowSelectionChangedBatch: 'rowSelectionChangedBatch',
  onRowFocusChanged: 'rowFocusChanged',
  onBeginCellEdit: 'beginCellEdit',
  onAfterCellEdit: 'afterCellEdit',
  onCancelCellEdit: 'cancelCellEdit',
  onPaginationChanged: 'paginationChanged',
  onNeedLoadMoreData: 'needLoadMoreData',
  onNeedLoadMoreDataTop: 'needLoadMoreDataTop',
  onSaveRow: 'saveRow',
  onValidationFailed: 'validationFailed',
  onLanguageChanged: 'languageChanged',
  onRenderingComplete: 'renderingComplete',
};

export function UiGrid(props: UiGridProps): React.ReactElement {
  // The grid element is the rendered JSX node — no wrapper div. React attaches
  // it via `ref`, and we mirror it into local state so the portal-render pass
  // below re-runs once the element exists.
  const [element, setElement] = React.useState<UiGridStandaloneElement | null>(null);
  const elementCallbackRef = React.useCallback(
    (node: UiGridStandaloneElement | null) => setElement(node),
    [],
  );

  // Track which slots are currently emitted by the element; each state key is
  // the slot name, value is the descriptor we need to render through.
  const [cellSlots, setCellSlots] = React.useState<Map<string, FrameworkCellSlot>>(() => new Map());
  const [headerSlots, setHeaderSlots] = React.useState<Map<string, FrameworkHeaderSlot>>(
    () => new Map(),
  );
  const [filterSlots, setFilterSlots] = React.useState<Map<string, FrameworkFilterSlot>>(
    () => new Map(),
  );
  const [groupRowSlots, setGroupRowSlots] = React.useState<Map<string, FrameworkGroupRowSlot>>(
    () => new Map(),
  );
  const [expandableSlots, setExpandableSlots] = React.useState<
    Map<string, FrameworkExpandableRowSlot>
  >(() => new Map());
  const [emptyStateSlot, setEmptyStateSlot] = React.useState<FrameworkEmptyStateSlot | null>(null);

  // ────── Slot-delta listeners on the element ──────
  React.useLayoutEffect(() => {
    if (!element) return;

    const applyDelta = <T extends { slotName: string }>(
      setter: React.Dispatch<React.SetStateAction<Map<string, T>>>,
    ) =>
      ((event: Event) => {
        const detail = (event as CustomEvent<FrameworkSlotDelta<T>>).detail;
        setter((prev) => {
          const next = new Map(prev);
          for (const slot of detail.removed) next.delete(slot.slotName);
          for (const slot of detail.added) next.set(slot.slotName, slot);
          return next;
        });
      }) as EventListener;

    const cellHandler = applyDelta<FrameworkCellSlot>(setCellSlots);
    const headerHandler = applyDelta<FrameworkHeaderSlot>(setHeaderSlots);
    const filterHandler = applyDelta<FrameworkFilterSlot>(setFilterSlots);
    const groupHandler = applyDelta<FrameworkGroupRowSlot>(setGroupRowSlots);
    const expandableHandler = applyDelta<FrameworkExpandableRowSlot>(setExpandableSlots);
    const emptyHandler: EventListener = (event) => {
      const detail = (event as CustomEvent<FrameworkSlotDelta<FrameworkEmptyStateSlot>>).detail;
      setEmptyStateSlot(detail.added[0] ?? null);
    };

    element.addEventListener('cellSlotsChanged', cellHandler);
    element.addEventListener('headerSlotsChanged', headerHandler);
    element.addEventListener('filterSlotsChanged', filterHandler);
    element.addEventListener('groupRowSlotsChanged', groupHandler);
    element.addEventListener('expandableRowSlotsChanged', expandableHandler);
    element.addEventListener('emptyStateSlotChanged', emptyHandler);

    return () => {
      element.removeEventListener('cellSlotsChanged', cellHandler);
      element.removeEventListener('headerSlotsChanged', headerHandler);
      element.removeEventListener('filterSlotsChanged', filterHandler);
      element.removeEventListener('groupRowSlotsChanged', groupHandler);
      element.removeEventListener('expandableRowSlotsChanged', expandableHandler);
      element.removeEventListener('emptyStateSlotChanged', emptyHandler);
    };
  }, [element]);

  // ────── Sync `options` (declarative props → imperative setter) ──────
  const mergedOptions = React.useMemo(
    () => mergePropsIntoOptions(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    depsFromProps(props),
  );

  React.useLayoutEffect(() => {
    if (!element) return;
    // Attach onRegisterApi via options so the element's init path wires it
    // through to the controller's gridApi factory. `onRegisterApi` is typed
    // as `(gridApi: unknown) => void` in core but we know the argument is a
    // UiGridApi at runtime — cast the passthrough to bridge the types.
    const nextOptions: GridOptions = props.onRegisterApi
      ? ({
          ...mergedOptions,
          onRegisterApi: props.onRegisterApi as (api: unknown) => void,
        } as GridOptions)
      : mergedOptions;
    element.options = nextOptions;
  }, [element, mergedOptions, props.onRegisterApi]);

  // ────── Declare which slots are framework-rendered ──────
  // When a fallback `cellRenderer` / `headerRenderer` is provided, flag every
  // column in the current columnDefs so the element emits slot placeholders
  // for all of them. The per-column entries in `cellRenderers` still take
  // precedence at render time.
  const columnNames = React.useMemo(() => {
    const columnDefs = props.columnDefs ?? props.options?.columnDefs ?? [];
    return columnDefs.map((c) => c.name);
  }, [props.columnDefs, props.options?.columnDefs]);

  const slotsConfig = React.useMemo<FrameworkRenderedSlotsConfig>(() => {
    const cellKeys = new Set<string>(props.cellRenderers ? Object.keys(props.cellRenderers) : []);
    if (props.cellRenderer) for (const name of columnNames) cellKeys.add(name);

    const headerKeys = new Set<string>(
      props.headerRenderers ? Object.keys(props.headerRenderers) : [],
    );
    if (props.headerRenderer) for (const name of columnNames) headerKeys.add(name);

    return {
      cells: Array.from(cellKeys),
      headers: Array.from(headerKeys),
      filters: props.filterRenderers ? Object.keys(props.filterRenderers) : [],
      groupRow: !!props.groupRowRenderer,
      expandableRow: !!props.expandableRenderer,
      emptyState: !!props.emptyRenderer,
    };
  }, [
    keyList(props.cellRenderers),
    keyList(props.headerRenderers),
    keyList(props.filterRenderers),
    props.cellRenderer,
    props.headerRenderer,
    props.groupRowRenderer,
    props.expandableRenderer,
    props.emptyRenderer,
    columnNames.join(','),
  ]);

  React.useLayoutEffect(() => {
    if (!element) return;
    element.setFrameworkRenderedSlots(slotsConfig);
  }, [element, slotsConfig]);

  // ────── Bridge DOM events → React event-prop callbacks ──────
  React.useLayoutEffect(() => {
    if (!element) return;
    const active: Array<[string, EventListener]> = [];
    for (const [propName, eventName] of Object.entries(EVENT_MAP)) {
      const handler = (props as Record<string, unknown>)[propName] as
        | ((event: CustomEvent) => void)
        | undefined;
      if (!handler) continue;
      const listener: EventListener = (event) => handler(event as CustomEvent);
      element.addEventListener(eventName, listener);
      active.push([eventName, listener]);
    }
    return () => {
      for (const [eventName, listener] of active) {
        element.removeEventListener(eventName, listener);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, ...eventHandlerDeps(props)]);

  // ────── Render the element + portals for every active framework slot ──────
  // The `<ui-grid-element>` is rendered directly as a React child — no wrapper
  // div. That means the element is a direct layout child of the consumer's
  // parent container, so height / flex / grid inheritance works out of the
  // box. Portals target the element itself (light DOM) and slot projection
  // composes them into the shadow tree.
  return (
    <ui-grid-element ref={elementCallbackRef} className={props.className} style={props.style}>
      {element ? (
        <>
          {Array.from(cellSlots.values()).map((slot) => {
            const renderer = props.cellRenderers?.[slot.columnName] ?? props.cellRenderer;
            if (!renderer) return null;
            return (
              <SlotPortal key={`cell:${slot.slotName}`} host={element} slot={slot.slotName}>
                {renderer(slot.context)}
              </SlotPortal>
            );
          })}
          {Array.from(headerSlots.values()).map((slot) => {
            const renderer = props.headerRenderers?.[slot.columnName] ?? props.headerRenderer;
            if (!renderer) return null;
            return (
              <SlotPortal key={`hdr:${slot.slotName}`} host={element} slot={slot.slotName}>
                {renderer(slot.context)}
              </SlotPortal>
            );
          })}
          {Array.from(filterSlots.values()).map((slot) => {
            const renderer = props.filterRenderers?.[slot.columnName];
            if (!renderer) return null;
            return (
              <SlotPortal key={`flt:${slot.slotName}`} host={element} slot={slot.slotName}>
                {renderer({
                  columnName: slot.columnName,
                  value: slot.value,
                  placeholder: slot.placeholder,
                  disabled: slot.disabled,
                  column: slot.column,
                })}
              </SlotPortal>
            );
          })}
          {Array.from(groupRowSlots.values()).map((slot) => {
            if (!props.groupRowRenderer) return null;
            return (
              <SlotPortal key={`grp:${slot.slotName}`} host={element} slot={slot.slotName}>
                {props.groupRowRenderer({
                  groupId: slot.groupId,
                  field: slot.field,
                  label: slot.label,
                  count: slot.count,
                  depth: slot.depth,
                  collapsed: slot.collapsed,
                })}
              </SlotPortal>
            );
          })}
          {Array.from(expandableSlots.values()).map((slot) => {
            if (!props.expandableRenderer) return null;
            return (
              <SlotPortal key={`exp:${slot.slotName}`} host={element} slot={slot.slotName}>
                {props.expandableRenderer(slot.context)}
              </SlotPortal>
            );
          })}
          {emptyStateSlot && props.emptyRenderer ? (
            <SlotPortal key="empty" host={element} slot="empty">
              {props.emptyRenderer({
                heading: emptyStateSlot.heading,
                description: emptyStateSlot.description,
              })}
            </SlotPortal>
          ) : null}
        </>
      ) : null}
    </ui-grid-element>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render children into a `<div slot="…">` inside the host element's light
 * DOM so shadow-DOM slot projection composes them into the grid.
 */
function SlotPortal({
  host,
  slot,
  children,
}: {
  host: HTMLElement;
  slot: string;
  children: React.ReactNode;
}): React.ReactElement {
  // Create a stable `<div>` per portal so React can reconcile children into
  // the same container across renders. The div is removed on unmount via the
  // useLayoutEffect cleanup.
  const divRef = React.useRef<HTMLDivElement | null>(null);
  if (!divRef.current) {
    const div = document.createElement('div');
    div.setAttribute('slot', slot);
    divRef.current = div;
  }

  React.useLayoutEffect(() => {
    const div = divRef.current;
    if (!div) return;
    host.appendChild(div);
    return () => {
      if (div.parentNode === host) host.removeChild(div);
    };
  }, [host]);

  return createPortal(children, divRef.current);
}

/**
 * Merge the individual attribute-style props into a full `GridOptions`.
 * `options` (if provided) wins, so consumers can use either style without
 * surprise.
 */
function mergePropsIntoOptions(props: UiGridProps): GridOptions {
  const base: GridOptions = {
    id: props.gridId ?? '__ui-grid-pending__',
    data: props.data ?? [],
    columnDefs: props.columnDefs ?? [],
  };

  if (props.grouping !== undefined) base.grouping = props.grouping;
  if (props.title !== undefined) base.title = props.title;
  if (props.rowHeight !== undefined) base.rowHeight = props.rowHeight;
  if (props.headerRowHeight !== undefined) base.headerRowHeight = props.headerRowHeight;
  if (props.viewportHeight !== undefined) base.viewportHeight = props.viewportHeight;
  if (props.paginationPageSize !== undefined) base.paginationPageSize = props.paginationPageSize;
  if (props.paginationPageSizes !== undefined) base.paginationPageSizes = props.paginationPageSizes;
  if (props.paginationCurrentPage !== undefined) base.paginationCurrentPage = props.paginationCurrentPage;
  if (props.totalItems !== undefined) base.totalItems = props.totalItems;
  if (props.virtualizationThreshold !== undefined) base.virtualizationThreshold = props.virtualizationThreshold;
  if (props.treeChildrenField !== undefined) base.treeChildrenField = props.treeChildrenField;
  if (props.treeIndent !== undefined) base.treeIndent = props.treeIndent;
  if (props.expandableRowHeight !== undefined) base.expandableRowHeight = props.expandableRowHeight;
  if (props.expandableRowHeaderWidth !== undefined) base.expandableRowHeaderWidth = props.expandableRowHeaderWidth;
  if (props.emptyMessage !== undefined) base.emptyMessage = props.emptyMessage;
  if (props.infiniteScrollRowsFromEnd !== undefined) base.infiniteScrollRowsFromEnd = props.infiniteScrollRowsFromEnd;

  if (props.enableSorting !== undefined) base.enableSorting = props.enableSorting;
  if (props.enableFiltering !== undefined) base.enableFiltering = props.enableFiltering;
  if (props.enableGrouping !== undefined) base.enableGrouping = props.enableGrouping;
  if (props.enablePinning !== undefined) base.enablePinning = props.enablePinning;
  if (props.enableColumnMoving !== undefined) base.enableColumnMoving = props.enableColumnMoving;
  if (props.enableColumnResizing !== undefined) base.enableColumnResizing = props.enableColumnResizing;
  if (props.enableCellEdit !== undefined) base.enableCellEdit = props.enableCellEdit;
  if (props.enableCellEditOnFocus !== undefined) base.enableCellEditOnFocus = props.enableCellEditOnFocus;
  if (props.enablePagination !== undefined) base.enablePagination = props.enablePagination;
  if (props.enablePaginationControls !== undefined) base.enablePaginationControls = props.enablePaginationControls;
  if (props.useExternalPagination !== undefined) base.useExternalPagination = props.useExternalPagination;
  if (props.enableExpandable !== undefined) base.enableExpandable = props.enableExpandable;
  if (props.enableTreeView !== undefined) base.enableTreeView = props.enableTreeView;
  if (props.showTreeExpandNoChildren !== undefined) base.showTreeExpandNoChildren = props.showTreeExpandNoChildren;
  if (props.treeRowHeaderAlwaysVisible !== undefined) base.treeRowHeaderAlwaysVisible = props.treeRowHeaderAlwaysVisible;
  if (props.enableAutoResize !== undefined) base.enableAutoResize = props.enableAutoResize;
  if (props.enableVirtualization !== undefined) base.enableVirtualization = props.enableVirtualization;
  if (props.enableInfiniteScroll !== undefined) base.enableInfiniteScroll = props.enableInfiniteScroll;
  if (props.infiniteScrollUp !== undefined) base.infiniteScrollUp = props.infiniteScrollUp;
  if (props.infiniteScrollDown !== undefined) base.infiniteScrollDown = props.infiniteScrollDown;

  if (props.enableRowSelection !== undefined) base.enableRowSelection = props.enableRowSelection;
  if (props.multiSelect !== undefined) base.multiSelect = props.multiSelect;
  if (props.noUnselect !== undefined) base.noUnselect = props.noUnselect;
  if (props.modifierKeysToMultiSelect !== undefined) base.modifierKeysToMultiSelect = props.modifierKeysToMultiSelect;
  if (props.enableRowHeaderSelection !== undefined) base.enableRowHeaderSelection = props.enableRowHeaderSelection;
  if (props.enableFullRowSelection !== undefined) base.enableFullRowSelection = props.enableFullRowSelection;
  if (props.enableFocusRowOnRowHeaderClick !== undefined) base.enableFocusRowOnRowHeaderClick = props.enableFocusRowOnRowHeaderClick;
  if (props.enableSelectRowOnFocus !== undefined) base.enableSelectRowOnFocus = props.enableSelectRowOnFocus;
  if (props.enableSelectAll !== undefined) base.enableSelectAll = props.enableSelectAll;
  if (props.enableSelectionBatchEvent !== undefined) base.enableSelectionBatchEvent = props.enableSelectionBatchEvent;
  if (props.enableFooterTotalSelected !== undefined) base.enableFooterTotalSelected = props.enableFooterTotalSelected;
  if (props.selectionRowHeaderWidth !== undefined) base.selectionRowHeaderWidth = props.selectionRowHeaderWidth;

  // `options` wins — full-options style is the escape hatch for anything
  // the individual props don't cover.
  if (props.options) {
    return { ...base, ...props.options };
  }
  return base;
}

/** Build the dependency array `useMemo` needs so the merged options rebuild
 * when any declarative prop changes. */
function depsFromProps(props: UiGridProps): React.DependencyList {
  return [
    props.options,
    props.gridId,
    props.title,
    props.data,
    props.columnDefs,
    props.grouping,
    props.rowHeight,
    props.headerRowHeight,
    props.viewportHeight,
    props.paginationPageSize,
    props.paginationPageSizes,
    props.paginationCurrentPage,
    props.totalItems,
    props.virtualizationThreshold,
    props.treeChildrenField,
    props.treeIndent,
    props.expandableRowHeight,
    props.expandableRowHeaderWidth,
    props.emptyMessage,
    props.infiniteScrollRowsFromEnd,
    props.enableSorting,
    props.enableFiltering,
    props.enableGrouping,
    props.enablePinning,
    props.enableColumnMoving,
    props.enableColumnResizing,
    props.enableCellEdit,
    props.enableCellEditOnFocus,
    props.enablePagination,
    props.enablePaginationControls,
    props.useExternalPagination,
    props.enableExpandable,
    props.enableTreeView,
    props.showTreeExpandNoChildren,
    props.treeRowHeaderAlwaysVisible,
    props.enableAutoResize,
    props.enableVirtualization,
    props.enableInfiniteScroll,
    props.infiniteScrollUp,
    props.infiniteScrollDown,
    props.enableRowSelection,
    props.multiSelect,
    props.noUnselect,
    props.modifierKeysToMultiSelect,
    props.enableRowHeaderSelection,
    props.enableFullRowSelection,
    props.enableFocusRowOnRowHeaderClick,
    props.enableSelectRowOnFocus,
    props.enableSelectAll,
    props.enableSelectionBatchEvent,
    props.enableFooterTotalSelected,
    props.selectionRowHeaderWidth,
  ];
}

/** Dependency list for the event-wiring effect — re-binds when any event
 * prop's identity changes. */
function eventHandlerDeps(props: UiGridProps): React.DependencyList {
  return Object.keys(EVENT_MAP).map(
    (key) => (props as Record<string, unknown>)[key],
  );
}

/** Stable key list for Record-valued props, so useMemo doesn't thrash on
 * every render when the consumer inlines their renderer map. */
function keyList(record: Record<string, unknown> | undefined): string {
  if (!record) return '';
  return Object.keys(record).sort().join(',');
}
