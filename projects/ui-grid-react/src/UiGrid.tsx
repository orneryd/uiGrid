import React from 'react';
import type {
  GridOptions,
  GridCellTemplateContext,
  GridExpandableTemplateContext,
  UiGridApi,
  GridColumnDef,
  GridRow,
} from '@ornery/ui-grid';
import type { DisplayItem, RowItem } from '@ornery/ui-grid';
import { useGridState } from './useGridState';
import { useVirtualScroll } from './useVirtualScroll';

export interface UiGridProps {
  options: GridOptions;
  onRegisterApi?: (api: UiGridApi) => void;
  cellRenderer?: (context: GridCellTemplateContext) => React.ReactNode;
  expandableRenderer?: (context: GridExpandableTemplateContext) => React.ReactNode;
  className?: string;
}

export function UiGrid({ options, onRegisterApi, cellRenderer, expandableRenderer, className }: UiGridProps) {
  const state = useGridState(options, onRegisterApi);

  const {
    pipeline,
    visibleColumns,
    labels,
    gridTemplateColumns,
    gridContainerRef,
    displayItems,
    virtualizationEnabled,
    pipelineMs,
    visibleRowCount,
    totalRows,
    benchmarkResult,
    rowSize,
    viewportHeightPx,
    editingValue,
    sortingFeature,
    filteringFeature,
    groupingFeature,
    paginationFeature,
    cellEditFeature,
    expandableFeature,
    treeViewFeature,
    csvExportFeature,
    paginationCurrentPage,
    paginationTotalPages,
    paginationSelectedPageSize,
  } = state;

  const virtualScroll = useVirtualScroll({
    itemCount: displayItems.length,
    itemSize: rowSize,
    viewportHeight: options.viewportHeight ?? 560,
    overscan: 3,
  });

  const itemsToRender = virtualizationEnabled
    ? displayItems.slice(virtualScroll.visibleRange.start, virtualScroll.visibleRange.end)
    : displayItems;

  const onViewportScroll = (event: React.UIEvent<HTMLDivElement>) => {
    virtualScroll.onScroll(event);
    const startIndex = Math.floor(event.currentTarget.scrollTop / rowSize);
    state.onViewportScroll(startIndex);
  };

  function renderDisplayItem(item: DisplayItem) {
    if (groupingFeature && state.isGroupItem(item)) {
      return (
        <button
          key={item.id}
          type="button"
          className="group-row ui-grid-row ui-grid-group-row"
          data-part="group-row"
          role="row"
          aria-expanded={!item.collapsed}
          style={{ gridColumn: '1 / -1', paddingInlineStart: `${item.depth * 1.25 + 1}rem` }}
          onClick={() => state.toggleGroup(item)}
        >
          <strong>{item.field}: {item.label}</strong>
          <span>{item.count} {labels.groupRowsSuffix}</span>
          <svg className="toggle-icon group-disclosure-icon" viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
            <path d={item.collapsed ? 'M10 7l5 5-5 5z' : 'M7 10l5 5 5-5z'} />
          </svg>
          <span className="sr-only ui-grid-sr-only">{state.groupDisclosureLabel(item)}</span>
        </button>
      );
    }

    if (expandableFeature && state.isExpandableItem(item)) {
      const ctx = state.expandedContext(item.row);
      return (
        <div
          key={item.id}
          className="expandable-row ui-grid-row ui-grid-expandable-row"
          data-part="expandable-row"
          style={{ gridColumn: '1 / -1', minHeight: `${item.row.expandedRowHeight}px` }}
        >
          {expandableRenderer?.(ctx)}
        </div>
      );
    }

    if (item.kind !== 'row') return null;
    const rowItem = item as RowItem;

    return visibleColumns.map((column) => (
      <div
        key={`${rowItem.row.id}-${column.name}`}
        className={cellClassName(rowItem, column)}
        data-part="body-cell"
        role="gridcell"
        tabIndex={0}
        data-row-id={rowItem.row.id}
        data-col-name={column.name}
        onFocus={() => state.focusCell(rowItem.row, column)}
        onClick={() => state.focusCell(rowItem.row, column)}
        onDoubleClick={(e) => state.handleCellDoubleClick(rowItem.row, column, e)}
        onKeyDown={(e) => state.handleCellKeyDown(rowItem.row, column, e)}
      >
        <div className="cell-shell" style={{ paddingInlineStart: state.cellIndent(rowItem.row, column) }}>
          {treeViewFeature && state.showTreeToggle(rowItem.row, column) && (
            <button
              type="button"
              className="row-toggle row-toggle-tree"
              data-part="tree-toggle"
              aria-label={state.treeToggleLabel(rowItem.row)}
              aria-expanded={state.isTreeRowExpanded(rowItem.row)}
              onClick={(e) => state.toggleTreeRow(rowItem.row, e)}
            >
              <svg className="toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
                <path d={state.isTreeRowExpanded(rowItem.row) ? 'M7 10l5 5 5-5z' : 'M10 7l5 5-5 5z'} />
              </svg>
            </button>
          )}
          {expandableFeature && state.showExpandToggle(rowItem.row, column) && (
            <button
              type="button"
              className="row-toggle row-toggle-expand"
              data-part="expand-toggle"
              aria-label={state.expandToggleLabel(rowItem.row)}
              aria-expanded={rowItem.row.expanded}
              onClick={(e) => state.toggleRowExpansion(rowItem.row, e)}
            >
              <svg className="toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
                <path d={rowItem.row.expanded ? 'M7 10l5 5 5-5z' : 'M10 7l5 5-5 5z'} />
              </svg>
            </button>
          )}
          <span className="cell-value">
            {cellEditFeature && state.isEditingCell(rowItem.row, column) ? (
              <input
                className="cell-editor"
                data-row-id={rowItem.row.id}
                data-col-name={column.name}
                aria-label={state.headerLabel(column)}
                type={state.editorInputType(column)}
                defaultValue={editingValue}
                onChange={(e) => state.updateEditingValue(e.target.value)}
                onKeyDown={(e) => state.handleEditorKeyDown(e)}
                onBlur={(e) => state.handleEditorBlur(e)}
              />
            ) : cellRenderer ? (
              cellRenderer(state.cellContext(rowItem.row, column)) ?? state.displayValue(rowItem.row, column)
            ) : (
              state.displayValue(rowItem.row, column)
            )}
          </span>
        </div>
      </div>
    ));
  }

  function cellClassName(item: RowItem, column: GridColumnDef): string {
    const classes = ['body-cell', 'ui-grid-cell'];
    if (state.isOddStripedRow(item)) classes.push('body-cell-odd');
    if (column.align === 'center') classes.push('align-center');
    if (column.align === 'end') classes.push('align-end');
    if (state.isFocusedCell(item.row, column)) classes.push('cell-focused');
    if (cellEditFeature && state.isEditingCell(item.row, column)) classes.push('cell-editing');
    return classes.join(' ');
  }

  function renderSortIcon(column: GridColumnDef) {
    const direction = state.sortDirection(column);
    switch (direction) {
      case 'asc':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
            <path d="M12 5l-6 6h4v8h4v-8h4z" />
          </svg>
        );
      case 'desc':
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
            <path d="M12 19l6-6h-4V5h-4v8H6z" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
            <path d="M7 6h10v2H7V6Zm0 5h7v2H7v-2Zm0 5h4v2H7v-2Z" />
          </svg>
        );
    }
  }

  return (
    <div className={`ui-grid-host ${className ?? ''}`} ref={gridContainerRef}>
      <section className="grid-shell ui-grid-shell" data-part="shell">
        <header className="grid-hero ui-grid-toolbar-shell" data-part="hero">
          <div>
            <p className="eyebrow">React wrapper for @ornery/ui-grid</p>
            <h1>{options.title ?? 'UI Grid'}</h1>
            <p className="deck">
              Familiar `gridOptions` and `onRegisterApi`, built with React hooks, virtualization,
              grouping, sorting, filtering, and column ordering.
            </p>
          </div>

          <div className="hero-actions">
            <button type="button" className="action action-secondary" data-part="action benchmark-action" onClick={() => state.runBenchmark()}>
              Benchmark
            </button>
            {csvExportFeature && (
              <button type="button" className="action action-secondary" data-part="action export-action" onClick={() => state.exportCsv()}>
                Export CSV
              </button>
            )}
            <div className="stats-card" data-part="stats-card">
              <span>{visibleRowCount}</span>
              <small>{labels.statsVisibleRows}</small>
            </div>
          </div>
        </header>

        <section className="metrics-strip" data-part="metrics" aria-label="Grid performance metrics">
          <article data-part="metric-card">
            <strong>{pipelineMs.toFixed(2)} ms</strong>
            <span>pipeline</span>
          </article>
          <article data-part="metric-card">
            <strong>{virtualizationEnabled ? 'On' : 'Off'}</strong>
            <span>virtualization</span>
          </article>
          <article data-part="metric-card">
            <strong>{state.groupByColumns.length}</strong>
            <span>group columns</span>
          </article>
          <article data-part="metric-card">
            <strong>{benchmarkResult?.averageMs?.toFixed(2) || '—'}</strong>
            <span>benchmark avg</span>
          </article>
        </section>

        <section className="grid-frame ui-grid" data-part="grid-frame" role="grid" aria-label={options.title ?? 'Data grid'}>
          <div className="grid-toolbar" data-part="grid-toolbar">
            <div>
              <strong>{visibleRowCount}</strong>
              <span>{labels.toolbarOf} {totalRows} {labels.toolbarRows}</span>
            </div>
            <p>
              `gridOptions` compatibility layer: sorting, filtering, grouping, column moving, templating,
              and virtualized rendering.
            </p>
          </div>

          <div className="grid-table ui-grid-contents-wrapper" data-part="grid-table">
            {/* Header row */}
            <div
              className="header-grid ui-grid-header ui-grid-header-canvas"
              data-part="header"
              role="row"
              style={{ gridTemplateColumns }}
            >
              {visibleColumns.map((column) => (
                <div
                  key={column.name}
                  className={`header-cell ui-grid-header-cell${sortingFeature && state.sortDirection(column) !== 'none' ? ' is-active' : ''}`}
                  data-part="header-cell"
                  role="columnheader"
                  aria-sort={sortingFeature ? state.sortAriaSort(column) as any : undefined}
                >
                  <span className="header-label">{state.headerLabel(column)}</span>

                  <div className="header-actions">
                    {sortingFeature && (
                      <button
                        type="button"
                        className={`header-action${!state.isColumnSortable(column) ? ' header-action-disabled' : ''}`}
                        disabled={!state.isColumnSortable(column)}
                        aria-label={state.sortButtonLabel(column)}
                        title={state.sortButtonLabel(column)}
                        onClick={() => state.toggleSort(column)}
                      >
                        {renderSortIcon(column)}
                        <span className="sr-only ui-grid-sr-only">{state.sortButtonLabel(column)}</span>
                      </button>
                    )}

                    {groupingFeature && state.isGroupingEnabled() && column.enableGrouping !== false && (
                      <button
                        type="button"
                        className={`chip-action${state.isGrouped(column) ? ' chip-action-active' : ''}`}
                        data-part="group-toggle"
                        aria-label={state.groupingButtonLabel(column)}
                        title={state.groupingButtonLabel(column)}
                        onClick={(e) => state.toggleGrouping(column, e)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
                          <path d="M4 6h8v4H4V6Zm0 8h8v4H4v-4Zm10-8h6v4h-6V6Zm0 8h6v4h-6v-4Z" />
                        </svg>
                        <span className="sr-only ui-grid-sr-only">{state.groupingButtonLabel(column)}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Filter row */}
            {filteringFeature && state.isFilteringEnabled() && (
              <div className="filter-grid ui-grid-header" data-part="filters" style={{ gridTemplateColumns }}>
                {visibleColumns.map((column) => (
                  <label key={column.name} className="filter-cell ui-grid-filter-container" data-part="filter-cell">
                    <span className="sr-only ui-grid-sr-only">{labels.filterColumn} {state.headerLabel(column)}</span>
                    <input
                      className="ui-grid-filter-input"
                      type="text"
                      defaultValue={state.filterValue(column.name)}
                      placeholder={state.filterPlaceholder(column)}
                      disabled={state.isFilterInputDisabled(column)}
                      onChange={(e) => state.updateFilter(column.name, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}

            {/* Body */}
            {displayItems.length > 0 ? (
              virtualizationEnabled ? (
                <div
                  className="grid-viewport ui-grid-viewport"
                  data-part="viewport"
                  ref={virtualScroll.viewportRef}
                  style={{ height: viewportHeightPx, overflow: 'auto', position: 'relative' }}
                  onScroll={onViewportScroll}
                >
                  <div style={{ height: `${virtualScroll.totalHeight}px`, position: 'relative' }}>
                    <div
                      className="body-grid ui-grid-canvas"
                      data-part="body"
                      role="rowgroup"
                      style={{
                        gridTemplateColumns,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        transform: `translateY(${virtualScroll.offsetY}px)`,
                      }}
                    >
                      {itemsToRender.map(renderDisplayItem)}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="body-grid ui-grid-canvas"
                  data-part="body"
                  role="rowgroup"
                  style={{ gridTemplateColumns }}
                >
                  {displayItems.map(renderDisplayItem)}
                </div>
              )
            ) : (
              <div className="empty-state ui-grid-no-row-overlay" data-part="empty-state">
                <strong>{options.emptyMessage ?? labels.emptyHeading}</strong>
                <p>{labels.emptyDescription}</p>
              </div>
            )}

            {/* Pagination footer */}
            {paginationFeature && state.showPaginationControls() && (
              <footer className="pagination-bar ui-grid-pagination" data-part="pagination" role="navigation" aria-label={labels.paginationPage}>
                <p>{state.paginationSummary()}</p>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="action action-secondary pagination-button"
                    aria-label={labels.paginationPrevious}
                    disabled={paginationCurrentPage <= 1}
                    onClick={() => state.previousPage()}
                  >
                    <svg className="pagination-icon" viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                    <span className="sr-only">{labels.paginationPrevious}</span>
                  </button>
                  <span>{labels.paginationPage} {paginationCurrentPage} {labels.paginationOf} {paginationTotalPages}</span>
                  <button
                    type="button"
                    className="action action-secondary pagination-button"
                    aria-label={labels.paginationNext}
                    disabled={paginationCurrentPage >= paginationTotalPages}
                    onClick={() => state.nextPage()}
                  >
                    <svg className="pagination-icon" viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
                      <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                    </svg>
                    <span className="sr-only">{labels.paginationNext}</span>
                  </button>
                  {state.pageSizeOptions().length > 0 && (
                    <label className="pagination-size">
                      <span className="sr-only">{labels.paginationRows}</span>
                      <select
                        aria-label={labels.paginationRows}
                        value={paginationSelectedPageSize}
                        onChange={(e) => state.onPageSizeChange(e.target.value)}
                      >
                        {state.pageSizeOptions().map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </footer>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
