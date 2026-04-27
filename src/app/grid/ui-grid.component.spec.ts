import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FILTER_CONDITIONS, SORT_DIRECTIONS } from './grid.constants';
import { UiGridApi } from './grid.api';
import { GridOptions } from './grid.models';
import { UiGridComponent } from './ui-grid.component';

describe('UiGridComponent', () => {
  const baseData = [
    {
      id: 'row-1',
      name: 'Gamma',
      status: 'Pilot',
      revenue: 300,
      active: true,
      account: { owner: 'Mina Patel' }
    },
    {
      id: 'row-2',
      name: 'alpha',
      status: 'Active',
      revenue: 100,
      active: false,
      account: { owner: 'Casey Tran' }
    },
    {
      id: 'row-3',
      name: 'Beta',
      status: 'Active',
      revenue: 200,
      active: true,
      account: { owner: 'Jordan Silva' }
    }
  ] as const;

  function createOptions(overrides: Partial<GridOptions> = {}, onRegisterApi?: (api: UiGridApi) => void): GridOptions {
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
          formatter: (value) => `$${value}`
        },
        { name: 'owner', field: 'account.owner' },
        {
          name: 'badge',
          cellRenderer: ({ row }) => `${row['name']}-badge`
        }
      ],
      onRegisterApi: (api) => onRegisterApi?.(api as UiGridApi),
      ...overrides
    };
  }

  function getShadowRoot(fixture: ReturnType<typeof TestBed.createComponent<UiGridComponent>>): ShadowRoot {
    const host = fixture.nativeElement as HTMLElement;
    if (!host.shadowRoot) {
      throw new Error('Expected a shadow root on app-ui-grid');
    }

    return host.shadowRoot;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiGridComponent]
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('registers the api and renders the configured headers and rows', () => {
    let gridApi: UiGridApi | null = null;
    const fixture = TestBed.createComponent(UiGridComponent);

    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const headers = [...shadowRoot.querySelectorAll('.header-action span')].map((node) => node.textContent?.trim());
    const bodyCells = [...shadowRoot.querySelectorAll('.body-cell')].map((node) => node.textContent?.trim());

    expect(gridApi).toBeTruthy();
    expect(headers).toEqual(['Customer', 'Status', 'Revenue', 'Owner', 'Badge']);
    expect(bodyCells).toContain('Gamma');
    expect(bodyCells).toContain('$300');
    expect(bodyCells).toContain('Mina Patel');
    expect(bodyCells).toContain('Gamma-badge');
    expect(shadowRoot.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
  });

  it('filters rows deterministically through the grid api and renders the empty state when no rows match', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const filterChanged = vi.fn();
    gridApi.core.on.filterChanged(filterChanged);

    gridApi.core.setFilter('status', 'Active');
    fixture.detectChanges();
    expect(filterChanged).toHaveBeenLastCalledWith({ status: 'Active' });
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual(['alpha', 'Beta']);

    gridApi.core.setFilter('status', 'Missing');
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    expect(gridApi.core.getVisibleRows()).toEqual([]);
    expect(shadowRoot.querySelector('.empty-state strong')?.textContent).toContain('Nothing to show');
  });

  it('sorts rows through the api and cycles sort state from the header button', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const sortChanged = vi.fn();
    gridApi.core.on.sortChanged(sortChanged);

    gridApi.core.sortColumn('name', SORT_DIRECTIONS.asc);
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual(['alpha', 'Beta', 'Gamma']);
    expect(sortChanged).toHaveBeenLastCalledWith('name', SORT_DIRECTIONS.asc);

    const shadowRoot = getShadowRoot(fixture);
    const headerButton = shadowRoot.querySelector('.header-action') as HTMLButtonElement;
    headerButton.click();
    fixture.detectChanges();
    expect(sortChanged).toHaveBeenLastCalledWith('name', SORT_DIRECTIONS.desc);
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual(['Gamma', 'Beta', 'alpha']);
  });

  it('groups rows, collapses groups, and raises grouping events', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const groupingChanged = vi.fn();
    gridApi.core.on.groupingChanged(groupingChanged);

    gridApi.core.groupByColumn('status');
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const initialGroups = shadowRoot.querySelectorAll('.group-row');
    expect(groupingChanged).toHaveBeenLastCalledWith(['status']);
    expect(initialGroups).toHaveLength(2);
    expect(shadowRoot.querySelectorAll('.body-cell')).toHaveLength(15);

    const activeGroup = [...initialGroups].find((node) => node.textContent?.includes('status: Active'));
    expect(activeGroup).toBeTruthy();

    (activeGroup as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(shadowRoot.querySelectorAll('.body-cell')).toHaveLength(5);
  });

  it('moves columns and raises column order events', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const columnOrderChanged = vi.fn();
    gridApi.core.on.columnOrderChanged(columnOrderChanged);

    gridApi.core.moveColumn(0, 2);
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const headers = [...shadowRoot.querySelectorAll('.header-action span')].map((node) => node.textContent?.trim());
    expect(columnOrderChanged).toHaveBeenLastCalledWith(['status', 'revenue', 'name', 'owner', 'badge']);
    expect(headers).toEqual(['Status', 'Revenue', 'Customer', 'Owner', 'Badge']);

    (fixture.componentInstance as any).onColumnDrop({ previousIndex: 1, currentIndex: 1 });
    expect(columnOrderChanged).toHaveBeenCalledTimes(1);
  });

  it('hides and restores rows using string, row object, and GridRow references', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    gridApi.core.setRowInvisible('row-2', 'manual');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-1', 'row-3']);

    gridApi.core.setRowInvisible(baseData[0], 'filter');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-3']);

    const remainingRow = gridApi.core.getVisibleRows()[0];
    gridApi.core.setRowInvisible(remainingRow, 'api');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows()).toEqual([]);

    gridApi.core.clearRowInvisible('row-2', 'manual');
    gridApi.core.clearRowInvisible(baseData[0], 'filter');
    gridApi.core.clearRowInvisible(remainingRow, 'api');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-1', 'row-2', 'row-3']);
  });

  it('exports visible rows as csv with the configured header labels', async () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const anchor = document.createElement('a');
    const originalCreateElement = document.createElement.bind(document);
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) =>
      tagName === 'a' ? anchor : originalCreateElement(tagName)) as typeof document.createElement);
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:spec-grid');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    gridApi.core.exportCsv();

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(anchor.download).toBe('spec-grid.csv');
    expect(anchor.href).toBe('blob:spec-grid');
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:spec-grid');

    const blob = createObjectUrlSpy.mock.calls[0][0] as Blob;
    const csv = await blob.text();
    expect(csv).toContain('Customer,Status,Revenue,Owner,Badge');
    expect(csv).toContain('Gamma,Pilot,$300,Mina Patel,Gamma-badge');
  });

  it('runs a deterministic benchmark and raises scroll events', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const benchmarkComplete = vi.fn();
    const scrollBegin = vi.fn();
    const scrollEnd = vi.fn();
    gridApi.core.on.benchmarkComplete(benchmarkComplete);
    gridApi.core.on.scrollBegin(scrollBegin);
    gridApi.core.on.scrollEnd(scrollEnd);

    const values = [100, 101, 102, 103, 104, 105, 106, 107];
    vi.spyOn(performance, 'now').mockImplementation(() => values.shift() ?? 107);

    const benchmark = gridApi.core.benchmark(3);
    expect(benchmark).toEqual({
      iterations: 3,
      totalMs: 7,
      averageMs: 7 / 3,
      visibleRows: 3,
      renderedItems: 3
    });
    expect(benchmarkComplete).toHaveBeenCalledWith(benchmark);

    vi.useFakeTimers();
    (fixture.componentInstance as any).onViewportIndexChange();
    (fixture.componentInstance as any).onViewportIndexChange();
    expect(scrollBegin).toHaveBeenCalledTimes(1);
    expect(scrollEnd).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(120);
    expect(scrollEnd).toHaveBeenCalledTimes(1);
  });

  it('enables virtualization when the row count crosses the threshold', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          virtualizationThreshold: 1,
          data: Array.from({ length: 5 }, (_value, index) => ({
            id: `virtual-${index}`,
            name: `Row ${index}`,
            status: index % 2 === 0 ? 'Active' : 'Pilot',
            revenue: index * 100,
            account: { owner: `Owner ${index}` }
          }))
        },
        (api) => {
          gridApi = api;
        }
      )
    );
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    expect(gridApi.core.getVisibleRows()).toHaveLength(5);
    expect(shadowRoot.querySelector('cdk-virtual-scroll-viewport')).not.toBeNull();
  });

  it('respects disabled feature flags and default sizing fallbacks', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          enableSorting: false,
          enableFiltering: false,
          enableGrouping: false,
          enableColumnMoving: false,
          enableVirtualization: false,
          rowHeight: undefined,
          viewportHeight: undefined,
          rowIdentity: undefined,
          columnDefs: [
            { name: 'name', visible: false },
            { name: 'status', sortable: false, filterable: false },
            { name: 'owner', field: 'account.owner' }
          ]
        },
        (api) => {
          gridApi = api;
        }
      )
    );
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const headersBefore = [...shadowRoot.querySelectorAll('.header-action span')].map((node) => node.textContent?.trim());
    expect(headersBefore).toEqual(['Status', 'Owner']);
    expect(shadowRoot.querySelector('.filter-grid')).toBeNull();
    expect(shadowRoot.querySelector('.chip-action')).toBeNull();
    expect((fixture.componentInstance as any).rowSize()).toBe(44);
    expect((fixture.componentInstance as any).viewportHeight()).toBe('560px');
    expect((fixture.componentInstance as any).isVirtualizationEnabled(100)).toBe(false);

    gridApi.core.setFilter('status', 'Active');
    gridApi.core.sortColumn('status');
    gridApi.core.moveColumn(0, 1);
    fixture.detectChanges();

    const headersAfter = [...shadowRoot.querySelectorAll('.header-action span')].map((node) => node.textContent?.trim());
    expect(headersAfter).toEqual(['Status', 'Owner']);
    expect(gridApi.core.getVisibleRows()).toHaveLength(3);
  });

  it('raises rendering and row visibility events when the options id changes and the pipeline shrinks', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const renderingComplete = vi.fn();
    const rowsRendered = vi.fn();
    const rowsVisibleChanged = vi.fn();
    const canvasHeightChanged = vi.fn();
    gridApi.core.on.renderingComplete(renderingComplete);
    gridApi.core.on.rowsRendered(rowsRendered);
    gridApi.core.on.rowsVisibleChanged(rowsVisibleChanged);
    gridApi.core.on.canvasHeightChanged(canvasHeightChanged);

    fixture.componentRef.setInput('options', createOptions({ id: 'spec-grid-2' }, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    expect(renderingComplete).toHaveBeenCalled();
    expect(rowsRendered).toHaveBeenCalled();
    expect(rowsVisibleChanged).toHaveBeenCalled();

    gridApi.core.setFilter('status', 'Missing');
    fixture.detectChanges();
    expect(rowsVisibleChanged).toHaveBeenLastCalledWith([]);
    expect(canvasHeightChanged).toHaveBeenCalled();
  });
});