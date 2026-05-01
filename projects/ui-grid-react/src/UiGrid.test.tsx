import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UiGrid } from './UiGrid';
import type { UiGridProps } from './UiGrid';
import type { GridOptions, UiGridApi, GridExpandableTemplateContext } from '@ornery/ui-grid';
import { SORT_DIRECTIONS, FILTER_CONDITIONS } from '@ornery/ui-grid';

const baseData = [
  {
    id: 'row-1',
    name: 'Gamma',
    status: 'Pilot',
    revenue: 300,
    active: true,
    account: { owner: 'Mina Patel' },
  },
  {
    id: 'row-2',
    name: 'alpha',
    status: 'Active',
    revenue: 100,
    active: false,
    account: { owner: 'Casey Tran' },
  },
  {
    id: 'row-3',
    name: 'Beta',
    status: 'Active',
    revenue: 200,
    active: true,
    account: { owner: 'Jordan Silva' },
  },
] as const;

function createOptions(
  overrides: Partial<GridOptions> = {},
  onRegisterApi?: (api: UiGridApi) => void
): GridOptions {
  return {
    id: 'spec-grid',
    title: 'Spec Grid',
    emptyMessage: 'Nothing to show',
    data: baseData,
    rowIdentity: (row) => String(row['id']),
    enableSorting: true,
    enableFiltering: true,
    enableGrouping: true,
    enableColumnMoving: true,
    enableVirtualization: true,
    virtualizationThreshold: 99,
    benchmark: { iterations: 3 },
    columnDefs: [
      { name: 'name', displayName: 'Customer' },
      { name: 'status' },
      {
        name: 'revenue',
        align: 'end',
        filter: { condition: FILTER_CONDITIONS.greaterThan },
        formatter: (value) => `$${value}`,
      },
      { name: 'owner', field: 'account.owner' },
      {
        name: 'badge',
        cellRenderer: ({ row }) => `${row['name']}-badge`,
      },
    ],
    onRegisterApi: (api) => onRegisterApi?.(api as UiGridApi),
    ...overrides,
  };
}

function renderGrid(
  overrides: Partial<GridOptions> = {},
  props: Partial<Omit<UiGridProps, 'options'>> = {}
): { container: HTMLElement; gridApi: UiGridApi } {
  let gridApi!: UiGridApi;
  const options = createOptions(overrides, (api) => {
    gridApi = api;
    props.onRegisterApi?.(api);
  });

  const { container } = render(
    <UiGrid options={options} onRegisterApi={options.onRegisterApi as any} {...props} />
  );

  return { container, gridApi };
}

describe('UiGrid React component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('registers the API and renders headers and rows', () => {
    const { container, gridApi } = renderGrid();

    const headers = Array.from(container.querySelectorAll('.header-label')).map(
      (el) => el.textContent?.trim()
    );
    const bodyCells = Array.from(container.querySelectorAll('.body-cell')).map(
      (el) => el.textContent?.trim()
    );

    expect(gridApi).toBeTruthy();
    expect(headers).toEqual(['Customer', 'Status', 'Revenue', 'Owner', 'Badge']);
    expect(bodyCells).toContain('Gamma');
    expect(bodyCells).toContain('$300');
    expect(bodyCells).toContain('Mina Patel');
    expect(bodyCells).toContain('Gamma-badge');
    expect(container.querySelector('.grid-viewport')).toBeNull();
  });

  it('filters rows and renders empty state', () => {
    const { container, gridApi } = renderGrid();

    const filterChanged = vi.fn();
    gridApi.core.on.filterChanged(filterChanged);

    act(() => {
      gridApi.core.setFilter('status', 'Active');
    });
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual([
      'alpha',
      'Beta',
    ]);

    act(() => {
      gridApi.core.setFilter('status', 'Missing');
    });

    expect(gridApi.core.getVisibleRows()).toEqual([]);
    expect(container.querySelector('.empty-state strong')?.textContent).toContain(
      'Nothing to show'
    );
  });

  it('sorts rows and cycles sort state from header button', () => {
    const { container, gridApi } = renderGrid();

    const sortChanged = vi.fn();
    gridApi.core.on.sortChanged(sortChanged);

    act(() => {
      gridApi.core.sortColumn('name', SORT_DIRECTIONS.asc);
    });
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual([
      'alpha',
      'Beta',
      'Gamma',
    ]);
    expect(sortChanged).toHaveBeenLastCalledWith('name', SORT_DIRECTIONS.asc);

    const headerButton = container.querySelector('.header-action') as HTMLButtonElement;
    act(() => {
      headerButton.click();
    });
    expect(sortChanged).toHaveBeenLastCalledWith('name', SORT_DIRECTIONS.desc);
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual([
      'Gamma',
      'Beta',
      'alpha',
    ]);
  });

  it('groups rows and collapses groups', () => {
    const { container, gridApi } = renderGrid();

    const groupingChanged = vi.fn();
    gridApi.core.on.groupingChanged(groupingChanged);

    act(() => {
      gridApi.core.groupByColumn('status');
    });

    const initialGroups = container.querySelectorAll('.group-row');
    expect(groupingChanged).toHaveBeenLastCalledWith(['status']);
    expect(initialGroups).toHaveLength(2);
    expect(container.querySelectorAll('.body-cell')).toHaveLength(15);

    const activeGroup = Array.from(initialGroups).find((node) =>
      node.textContent?.includes('status: Active')
    );
    expect(activeGroup).toBeTruthy();

    act(() => {
      (activeGroup as HTMLButtonElement).click();
    });
    expect(container.querySelectorAll('.body-cell')).toHaveLength(5);
  });

  it('exports visible rows as CSV', async () => {
    const { gridApi } = renderGrid();

    const anchor = document.createElement('a');
    const originalCreateElement = document.createElement.bind(document);
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation(
      ((tagName: string) =>
        tagName === 'a' ? anchor : originalCreateElement(tagName)) as typeof document.createElement
    );
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:spec-grid');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    act(() => {
      gridApi.core.exportCsv();
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(anchor.download).toBe('spec-grid.csv');

    const blob = createObjectUrlSpy.mock.calls[0][0] as Blob;
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    expect(csv).toContain('Customer,Status,Revenue,Owner,Badge');
    expect(csv).toContain('Gamma,Pilot,$300,Mina Patel,Gamma-badge');
  });

  it('virtualizes rows when count crosses threshold', () => {
    const { container, gridApi } = renderGrid({
      virtualizationThreshold: 1,
      data: Array.from({ length: 5 }, (_, index) => ({
        id: `virtual-${index}`,
        name: `Row ${index}`,
        status: index % 2 === 0 ? 'Active' : 'Pilot',
        revenue: index * 100,
        account: { owner: `Owner ${index}` },
      })),
    });

    expect(gridApi.core.getVisibleRows()).toHaveLength(5);
    expect(container.querySelector('.grid-virtual-spacer')).not.toBeNull();
    expect(container.querySelector('.grid-virtual-body')).not.toBeNull();
  });

  it('paginates rows', () => {
    const { container, gridApi } = renderGrid({
      enablePagination: true,
      enablePaginationControls: true,
      paginationPageSizes: [1, 2],
      paginationPageSize: 1,
      paginationCurrentPage: 1,
    });

    const paginationChanged = vi.fn();
    gridApi.pagination.on.paginationChanged(paginationChanged);

    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-1']);
    expect(gridApi.pagination.getTotalPages()).toBe(3);

    act(() => {
      gridApi.pagination.nextPage();
    });
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-2']);
    expect(paginationChanged).toHaveBeenLastCalledWith(2, 1);

    act(() => {
      gridApi.pagination.setPageSize(2);
    });
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-1', 'row-2']);

    expect(container.querySelector('.pagination-bar')?.textContent).toContain('1-2 of 3');
  });

  it('keyboard cell editing: commit, navigate, cancel', async () => {
    const { container, gridApi } = renderGrid({
      enableGrouping: false,
      enableCellEditOnFocus: true,
      columnDefs: [
        { name: 'name', displayName: 'Customer', enableCellEdit: true },
        { name: 'status' },
        { name: 'owner', field: 'account.owner', enableCellEdit: true },
      ],
    });

    const beginCellEdit = vi.fn();
    const afterCellEdit = vi.fn();
    const cancelCellEdit = vi.fn();
    gridApi.edit.on.beginCellEdit(beginCellEdit);
    gridApi.edit.on.afterCellEdit(afterCellEdit);
    gridApi.edit.on.cancelCellEdit(cancelCellEdit);

    const firstNameCell = container.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="name"]'
    ) as HTMLElement;

    await act(async () => {
      firstNameCell.focus();
      fireEvent.keyDown(firstNameCell, { key: 'Z' });
    });

    let editor = container.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="name"]'
    ) as HTMLInputElement;
    expect(editor).toBeTruthy();
    expect(beginCellEdit).toHaveBeenCalled();

    await act(async () => {
      fireEvent.keyDown(editor, { key: 'Tab' });
    });

    expect(gridApi.core.getVisibleRows()[0]?.entity['name']).toBe('Z');
    expect(afterCellEdit).toHaveBeenCalled();

    const ownerCell = container.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="owner"]'
    ) as HTMLElement;

    await act(async () => {
      ownerCell.focus();
      fireEvent.keyDown(ownerCell, { key: 'F2' });
    });

    editor = container.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="owner"]'
    ) as HTMLInputElement;
    expect(editor).toBeTruthy();

    await act(async () => {
      fireEvent.change(editor, { target: { value: 'Taylor Morgan' } });
      fireEvent.keyDown(editor, { key: 'Escape' });
    });

    expect(gridApi.core.getVisibleRows()[0]?.entity['account']).toEqual({
      owner: 'Mina Patel',
    });
    expect(cancelCellEdit).toHaveBeenCalled();
  });

  it('resolves custom i18n label overrides', () => {
    const { container } = renderGrid({
      labels: {
        sortDefault: 'Trier',
        sortAsc: 'Tri croissant',
        paginationNext: 'Suivant',
      },
    });

    const sortButton = container.querySelector('.header-action') as HTMLButtonElement;
    expect(sortButton.getAttribute('aria-label')).toBe('Trier');
  });

  it('feature flags disable unused template sections', () => {
    const { container, gridApi } = renderGrid({
      enableSorting: false,
      enableFiltering: false,
      enableGrouping: false,
      enableColumnMoving: false,
      enableVirtualization: false,
      columnDefs: [
        { name: 'name', visible: false },
        { name: 'status', sortable: false, filterable: false },
        { name: 'owner', field: 'account.owner' },
      ],
    });

    const headers = Array.from(container.querySelectorAll('.header-label')).map(
      (el) => el.textContent?.trim()
    );
    expect(headers).toEqual(['Status', 'Owner']);
    expect(container.querySelector('.filter-grid')).toBeNull();
    expect(container.querySelector('.chip-action')).toBeNull();
    expect(gridApi.core.getVisibleRows()).toHaveLength(3);
  });
});
