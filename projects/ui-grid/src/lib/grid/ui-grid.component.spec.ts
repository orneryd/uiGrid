import { Component, TemplateRef, computed, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  FILTER_CONDITIONS,
  SORT_DIRECTIONS,
  type GridColumnDef,
  type GridExpandableTemplateContext,
  type GridOptions,
  type UiGridApi,
} from '@ornery/ui-grid-core';
import { UiGridComponent } from './ui-grid.component';

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
  onRegisterApi?: (api: UiGridApi) => void,
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

@Component({
  imports: [UiGridComponent],
  template: `
    <ng-template #detail let-row>
      <div class="detail-row">{{ row.name }} detail</div>
    </ng-template>
    <app-ui-grid [options]="options()" />
  `,
})
class ExpandableHostComponent {
  private readonly registeredApi = signal<UiGridApi | null>(null);
  private readonly detailTemplate =
    viewChild.required<TemplateRef<GridExpandableTemplateContext>>('detail');

  readonly options = computed<GridOptions>(() =>
    createOptions(
      {
        enableExpandable: true,
        expandableRowTemplate: this.detailTemplate(),
        virtualizationThreshold: 99,
      },
      (api) => this.registeredApi.set(api),
    ),
  );

  readonly gridApi = this.registeredApi;
}

@Component({
  imports: [UiGridComponent],
  template: `
    <ng-template #status let-value>
      <span class="inline-status">{{ value }}</span>
    </ng-template>
    <app-ui-grid [options]="options()" />
  `,
})
class CellTemplateHostComponent {
  private readonly registeredApi = signal<UiGridApi | null>(null);
  private readonly statusTemplate = viewChild.required<TemplateRef<unknown>>('status');

  readonly options = computed<GridOptions>(() =>
    createOptions(
      {
        columnDefs: [
          { name: 'name', displayName: 'Customer' },
          { name: 'status', cellTemplate: this.statusTemplate() as TemplateRef<any> },
        ],
        virtualizationThreshold: 99,
      },
      (api) => this.registeredApi.set(api),
    ),
  );
}

@Component({
  imports: [UiGridComponent],
  template: `
    <ng-template #detail let-row>
      <div class="virtual-detail">{{ row.name }} virtual detail</div>
    </ng-template>
    <app-ui-grid [options]="options()" />
  `,
})
class VirtualExpandableHostComponent {
  private readonly registeredApi = signal<UiGridApi | null>(null);
  private readonly detailTemplate =
    viewChild.required<TemplateRef<GridExpandableTemplateContext>>('detail');

  readonly options = computed<GridOptions>(() =>
    createOptions(
      {
        data: Array.from({ length: 6 }, (_value, index) => ({
          id: `row-${index + 1}`,
          name: `Row ${index + 1}`,
          status: index % 2 === 0 ? 'Active' : 'Pilot',
          revenue: index * 100,
          account: { owner: `Owner ${index + 1}` },
        })),
        enableExpandable: true,
        expandableRowTemplate: this.detailTemplate(),
        virtualizationThreshold: 1,
      },
      (api) => this.registeredApi.set(api),
    ),
  );

  readonly gridApi = this.registeredApi;
}

describe('UiGridComponent', () => {
  function getShadowRoot(
    fixture: ReturnType<typeof TestBed.createComponent<UiGridComponent>>,
  ): ShadowRoot {
    const host = fixture.nativeElement as HTMLElement;
    if (!host.shadowRoot) {
      throw new Error('Expected a shadow root on app-ui-grid');
    }

    return host.shadowRoot;
  }

  /**
   * Create a KeyboardEvent guaranteed to belong to the element's own jsdom realm.
   *
   * `document.createEvent` always produces an event that passes jsdom's internal
   * realm check in `dispatchEvent`, unlike constructor-based events which may
   * originate from a different global (test-runner vs jsdom window).
   *
   * `bubbles` defaults to false (matching `new KeyboardEvent(...)` defaults) to
   * avoid double-handling when the editor `<input>` is nested inside a cell `<div>`
   * that also binds `(keydown)`.
   */
  function keyDown(el: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
    const evt = el.ownerDocument.createEvent('KeyboardEvent');
    evt.initEvent('keydown', init.bubbles ?? false, init.cancelable ?? false);
    Object.defineProperties(evt, {
      key: { get: () => init.key ?? '' },
      shiftKey: { get: () => init.shiftKey ?? false },
      ctrlKey: { get: () => init.ctrlKey ?? false },
      altKey: { get: () => init.altKey ?? false },
      metaKey: { get: () => init.metaKey ?? false },
    });
    return evt as KeyboardEvent;
  }

  /** Create a plain Event guaranteed to belong to the element's own jsdom realm. */
  function domEvent(el: HTMLElement, type: string): Event {
    const evt = el.ownerDocument.createEvent('Event');
    evt.initEvent(type, false, false);
    return evt;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        UiGridComponent,
        ExpandableHostComponent,
        CellTemplateHostComponent,
        VirtualExpandableHostComponent,
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('registers the api and renders the configured headers and rows', () => {
    let gridApi: UiGridApi | null = null;
    const fixture = TestBed.createComponent(UiGridComponent);

    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const headers = [...shadowRoot.querySelectorAll('.header-label')].map((node) =>
      node.textContent?.trim(),
    );
    const bodyCells = [...shadowRoot.querySelectorAll('.body-cell')].map((node) =>
      node.textContent?.trim(),
    );

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
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    const filterChanged = vi.fn();
    gridApi.core.on.filterChanged(filterChanged);

    gridApi.core.setFilter('status', 'Active');
    fixture.detectChanges();
    expect(filterChanged).toHaveBeenLastCalledWith({ status: 'Active' });
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual([
      'alpha',
      'Beta',
    ]);

    gridApi.core.setFilter('status', 'Missing');
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    expect(gridApi.core.getVisibleRows()).toEqual([]);
    expect(shadowRoot.querySelector('.empty-state strong')?.textContent).toContain(
      'Nothing to show',
    );
  });

  it('sorts rows through the api and cycles sort state from the header button', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    const sortChanged = vi.fn();
    gridApi.core.on.sortChanged(sortChanged);

    gridApi.core.sortColumn('name', SORT_DIRECTIONS.asc);
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual([
      'alpha',
      'Beta',
      'Gamma',
    ]);
    expect(sortChanged).toHaveBeenLastCalledWith('name', SORT_DIRECTIONS.asc);

    const shadowRoot = getShadowRoot(fixture);
    const headerButton = shadowRoot.querySelector('.header-action') as HTMLButtonElement;
    headerButton.click();
    fixture.detectChanges();
    expect(sortChanged).toHaveBeenLastCalledWith('name', SORT_DIRECTIONS.desc);
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual([
      'Gamma',
      'Beta',
      'alpha',
    ]);
  });

  it('groups rows, collapses groups, and raises grouping events', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
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

    const activeGroup = [...initialGroups].find((node) =>
      node.textContent?.includes('status: Active'),
    );
    expect(activeGroup).toBeTruthy();

    const firstGroupedOwnerCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-2"][data-col-name="owner"]',
    );
    const secondGroupedOwnerCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-3"][data-col-name="owner"]',
    );
    expect(firstGroupedOwnerCell?.classList.contains('body-cell-odd')).toBe(true);
    expect(secondGroupedOwnerCell?.classList.contains('body-cell-odd')).toBe(false);

    (activeGroup as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(shadowRoot.querySelectorAll('.body-cell')).toHaveLength(5);
  });

  it('moves columns and raises column order events', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    const columnOrderChanged = vi.fn();
    gridApi.core.on.columnOrderChanged(columnOrderChanged);

    gridApi.core.moveColumn(0, 2);
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const headers = [...shadowRoot.querySelectorAll('.header-label')].map((node) =>
      node.textContent?.trim(),
    );
    expect(columnOrderChanged).toHaveBeenLastCalledWith([
      'status',
      'revenue',
      'name',
      'owner',
      'badge',
    ]);
    expect(headers).toEqual(['Status', 'Revenue', 'Customer', 'Owner', 'Badge']);

    (fixture.componentInstance as any).onColumnDrop({
      previousIndex: 1,
      currentIndex: 1,
      item: { data: (fixture.componentInstance as any).visibleColumns()[1] },
      container: { data: (fixture.componentInstance as any).visibleColumns() },
    });
    expect(columnOrderChanged).toHaveBeenCalledTimes(1);
  });

  it('reorders visible columns without shifting hidden columns ahead of the drop target', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          columnDefs: [
            { name: 'id', visible: false },
            { name: 'name', displayName: 'Customer' },
            { name: 'status' },
            { name: 'revenue' },
            { name: 'owner', field: 'account.owner' },
            { name: 'badge' },
          ],
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    (fixture.componentInstance as any).onColumnDrop({
      previousIndex: 3,
      currentIndex: 1,
      item: { data: { name: 'badge' } },
      container: { data: (fixture.componentInstance as any).visibleColumns() },
    });
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const headers = [...shadowRoot.querySelectorAll('.header-label')].map((node) =>
      node.textContent?.trim(),
    );

    expect(headers).toEqual(['Customer', 'Badge', 'Status', 'Revenue', 'Owner']);
    expect((fixture.componentInstance as any).columnOrder()).toEqual([
      'id',
      'name',
      'badge',
      'status',
      'revenue',
      'owner',
    ]);
  });

  it('hides and restores rows using string, row object, and GridRow references', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
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

  it('keeps a row hidden until all invisible reasons are cleared', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    gridApi.core.setRowInvisible('row-1', 'manual');
    gridApi.core.setRowInvisible('row-1', 'api');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-2', 'row-3']);

    gridApi.core.clearRowInvisible('row-1', 'manual');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-2', 'row-3']);

    gridApi.core.clearRowInvisible('row-1', 'api');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-1', 'row-2', 'row-3']);
  });

  it('exports visible rows as csv with the configured header labels', async () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    const anchor = document.createElement('a');
    const originalCreateElement = document.createElement.bind(document);
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) =>
        tagName === 'a'
          ? anchor
          : originalCreateElement(tagName)) as typeof document.createElement);
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

  it('sanitizes csv export values that could be interpreted as spreadsheet formulas', async () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          id: 'invoice=2026/04',
          data: [
            {
              id: 'row-1',
              name: '=SUM(1,1)',
              status: '+Danger',
              revenue: 100,
              active: true,
              account: { owner: '@mention' },
            },
          ],
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const anchor = document.createElement('a');
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(anchor, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) =>
      tagName === 'a' ? anchor : originalCreateElement(tagName)) as typeof document.createElement);
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:safe-csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    gridApi.core.exportCsv();

    expect(anchor.download).toBe('invoice_2026_04.csv');

    const blob = createObjectUrlSpy.mock.calls[0][0] as Blob;
    const csv = await blob.text();
    expect(csv).toContain('"\'=SUM(1,1)"');
    expect(csv).toContain("'+Danger");
    expect(csv).toContain("'@mention");
  });

  it('runs a deterministic benchmark and raises scroll events', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
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
      renderedItems: 3,
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
            account: { owner: `Owner ${index}` },
          })),
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    expect(gridApi.core.getVisibleRows()).toHaveLength(5);
    expect(shadowRoot.querySelector('.grid-virtual-spacer')).not.toBeNull();
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
          rowIdentity: undefined,
          columnDefs: [
            { name: 'name', visible: false },
            { name: 'status', sortable: false, filterable: false },
            { name: 'owner', field: 'account.owner' },
          ],
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const headersBefore = [...shadowRoot.querySelectorAll('.header-label')].map((node) =>
      node.textContent?.trim(),
    );
    expect(headersBefore).toEqual(['Status', 'Owner']);
    expect(shadowRoot.querySelector('.filter-grid')).toBeNull();
    expect(shadowRoot.querySelector('.chip-action')).toBeNull();
    expect((fixture.componentInstance as any).rowSize()).toBe(44);
    expect((fixture.componentInstance as any).viewportHeight()).toBe('440px');
    expect((fixture.componentInstance as any).isVirtualizationEnabled(100)).toBe(false);

    gridApi.core.setFilter('status', 'Active');
    gridApi.core.sortColumn('status');
    gridApi.core.moveColumn(0, 1);
    gridApi.expandable.toggleRowExpansion(baseData[0]);
    gridApi.expandable.expandAllRows();
    fixture.detectChanges();

    const headersAfter = [...shadowRoot.querySelectorAll('.header-label')].map((node) =>
      node.textContent?.trim(),
    );
    expect(headersAfter).toEqual(['Status', 'Owner']);
    expect(gridApi.core.getVisibleRows()).toHaveLength(3);
    expect(shadowRoot.querySelector('.detail-row')).toBeNull();
  });

  it('raises rendering and row visibility events when the options id changes and the pipeline shrinks', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    const renderingComplete = vi.fn();
    const rowsRendered = vi.fn();
    const rowsVisibleChanged = vi.fn();
    const canvasHeightChanged = vi.fn();
    gridApi.core.on.renderingComplete(renderingComplete);
    gridApi.core.on.rowsRendered(rowsRendered);
    gridApi.core.on.rowsVisibleChanged(rowsVisibleChanged);
    gridApi.core.on.canvasHeightChanged(canvasHeightChanged);

    fixture.componentRef.setInput(
      'options',
      createOptions({ id: 'spec-grid-2' }, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    expect(renderingComplete).toHaveBeenCalled();
    expect(rowsRendered).toHaveBeenCalled();
    expect(rowsVisibleChanged).toHaveBeenCalled();

    gridApi.core.setFilter('status', 'Missing');
    fixture.detectChanges();
    expect(rowsVisibleChanged).toHaveBeenLastCalledWith([]);
    expect(canvasHeightChanged).toHaveBeenCalled();
  });

  it('paginates rows and raises pagination events deterministically', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          enablePagination: true,
          enablePaginationControls: true,
          paginationPageSizes: [1, 2],
          paginationPageSize: 1,
          paginationCurrentPage: 1,
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const paginationChanged = vi.fn();
    gridApi.pagination.on.paginationChanged(paginationChanged);

    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-1']);
    expect(gridApi.pagination.getTotalPages()).toBe(3);
    expect(gridApi.pagination.getFirstRowIndex()).toBe(0);
    expect(gridApi.pagination.getLastRowIndex()).toBe(0);

    gridApi.pagination.nextPage();
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-2']);
    expect(paginationChanged).toHaveBeenLastCalledWith(2, 1);

    gridApi.pagination.setPageSize(2);
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['row-1', 'row-2']);

    const shadowRoot = getShadowRoot(fixture);
    expect(shadowRoot.querySelector('.pagination-bar')?.textContent).toContain('1-2 of 3');
  });

  it('handles pagination button clicks, empty summaries, and invalid page sizes from the template', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          data: [],
          enablePagination: true,
          enablePaginationControls: true,
          paginationPageSizes: [1, 2],
          paginationPageSize: 1,
          paginationCurrentPage: 1,
          emptyMessage: 'No data',
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    expect(shadowRoot.querySelector('.pagination-bar p')?.textContent).toContain('0-0 of 0');
    expect(shadowRoot.querySelector('.empty-state strong')?.textContent).toContain('No data');

    (fixture.componentInstance as any).onPageSizeChange('not-a-number');
    fixture.detectChanges();
    expect(gridApi.pagination.getPage()).toBe(1);
    expect(gridApi.pagination.getLastRowIndex()).toBe(0);
  });

  it('clamps external pagination through the api wrappers and keeps external row indices stable', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          enablePagination: true,
          useExternalPagination: true,
          totalItems: 7,
          paginationPageSizes: [2, 5],
          paginationCurrentPage: 3,
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const paginationChanged = vi.fn();
    gridApi.pagination.on.paginationChanged(paginationChanged);

    expect(gridApi.pagination.getPage()).toBe(3);
    expect(gridApi.pagination.getTotalPages()).toBe(4);
    expect(gridApi.pagination.getFirstRowIndex()).toBe(0);
    expect(gridApi.pagination.getLastRowIndex()).toBe(6);

    gridApi.pagination.previousPage();
    fixture.detectChanges();
    expect(gridApi.pagination.getPage()).toBe(2);

    gridApi.pagination.seek(99);
    fixture.detectChanges();
    expect(gridApi.pagination.getPage()).toBe(4);

    gridApi.pagination.seek(-2);
    fixture.detectChanges();
    expect(gridApi.pagination.getPage()).toBe(1);

    gridApi.pagination.setPageSize(-1);
    fixture.detectChanges();
    expect(gridApi.pagination.getTotalPages()).toBe(4);

    gridApi.pagination.setPageSize(5);
    fixture.detectChanges();
    expect(gridApi.pagination.getPage()).toBe(1);
    expect(gridApi.pagination.getTotalPages()).toBe(2);
    expect(paginationChanged).toHaveBeenLastCalledWith(1, 5);
  });

  it('renders expandable rows and exposes the expandable api', async () => {
    const fixture = TestBed.createComponent(ExpandableHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    const gridApi = host.gridApi();
    expect(gridApi).toBeTruthy();

    const expandedChanged = vi.fn();
    gridApi!.expandable.on.rowExpandedStateChanged(expandedChanged);

    const rootElement = fixture.nativeElement as HTMLElement;
    const gridHost = rootElement.querySelector('app-ui-grid') as HTMLElement;
    const shadowRoot = gridHost.shadowRoot!;
    const expandButton = shadowRoot.querySelector('.row-toggle-expand') as HTMLButtonElement;
    expandButton.click();
    fixture.detectChanges();

    expect(shadowRoot.querySelector('.detail-row')?.textContent).toContain('Gamma detail');
    expect(expandedChanged).toHaveBeenCalled();

    gridApi!.expandable.collapseAllRows();
    fixture.detectChanges();
    expect(shadowRoot.querySelector('.detail-row')).toBeNull();

    gridApi!.expandable.toggleAllRows();
    fixture.detectChanges();
    expect(shadowRoot.querySelector('.detail-row')).not.toBeNull();

    gridApi!.expandable.toggleAllRows();
    fixture.detectChanges();
    expect(shadowRoot.querySelector('.detail-row')).toBeNull();
  });

  it('supports tree view expansion, collapse, and tree state access', () => {
    let gridApi!: UiGridApi;
    const treeData = [
      {
        id: 'parent-1',
        name: 'Parent 1',
        status: 'Active',
        revenue: 500,
        account: { owner: 'Owner 1' },
        children: [
          {
            id: 'child-1',
            name: 'Child 1',
            status: 'Pilot',
            revenue: 150,
            account: { owner: 'Owner 1A' },
          },
          {
            id: 'child-2',
            name: 'Child 2',
            status: 'Pilot',
            revenue: 180,
            account: { owner: 'Owner 1B' },
          },
        ],
      },
      {
        id: 'parent-2',
        name: 'Parent 2',
        status: 'Pilot',
        revenue: 220,
        account: { owner: 'Owner 2' },
        children: [],
      },
    ];
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          data: treeData,
          enableTreeView: true,
          treeChildrenField: 'children',
          showTreeExpandNoChildren: false,
          enableGrouping: false,
          virtualizationThreshold: 99,
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const rowExpanded = vi.fn();
    const rowCollapsed = vi.fn();
    gridApi.treeBase.on.rowExpanded(rowExpanded);
    gridApi.treeBase.on.rowCollapsed(rowCollapsed);

    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'parent-2']);
    expect(gridApi.treeBase.getRowChildren('parent-1').map((row) => row.id)).toEqual([
      'child-1',
      'child-2',
    ]);

    gridApi.treeBase.expandRow('parent-1');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual([
      'parent-1',
      'child-1',
      'child-2',
      'parent-2',
    ]);
    expect(rowExpanded).toHaveBeenCalled();

    gridApi.treeView.setTreeView({ 'parent-1': false });
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'parent-2']);
    expect(gridApi.treeView.getTreeView()).toEqual({ 'parent-1': false });

    gridApi.treeBase.toggleRowTreeState('parent-1');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual([
      'parent-1',
      'child-1',
      'child-2',
      'parent-2',
    ]);

    gridApi.treeBase.collapseRow('parent-1');
    fixture.detectChanges();
    expect(rowCollapsed).toHaveBeenCalled();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'parent-2']);

    gridApi.treeBase.expandAllRows();
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual([
      'parent-1',
      'child-1',
      'child-2',
      'parent-2',
    ]);

    gridApi.treeBase.collapseAllRows();
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'parent-2']);

    const shadowRoot = getShadowRoot(fixture);
    const treeToggle = shadowRoot.querySelector('.row-toggle-tree') as HTMLButtonElement;
    treeToggle.click();
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual([
      'parent-1',
      'child-1',
      'child-2',
      'parent-2',
    ]);

    treeToggle.click();
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'parent-2']);
  });

  it('renders non-virtual cell templates and tree toggles through the template branch', async () => {
    const fixture = TestBed.createComponent(CellTemplateHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const rootElement = fixture.nativeElement as HTMLElement;
    const gridHost = rootElement.querySelector('app-ui-grid') as HTMLElement;
    const shadowRoot = gridHost.shadowRoot!;
    expect(shadowRoot.querySelector('.inline-status')?.textContent).toContain('Pilot');
  });

  it('exposes helper labels used by the shared display template', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    const statusColumn = createOptions().columnDefs[1];
    const statusRow = gridApi.core.getVisibleRows()[0];

    expect(component.sortButtonLabel(statusColumn)).toBe('Sort');
    component.sortState.set({ columnName: 'status', direction: SORT_DIRECTIONS.asc });
    expect(component.sortButtonLabel(statusColumn)).toBe('Sort ascending');
    component.sortState.set({ columnName: 'status', direction: SORT_DIRECTIONS.desc });
    expect(component.sortButtonLabel(statusColumn)).toBe('Sort descending');

    expect(component.sortAriaSort(statusColumn)).toBe('descending');
    component.sortState.set({ columnName: 'status', direction: SORT_DIRECTIONS.none });
    expect(component.sortAriaSort(statusColumn)).toBe('none');

    expect(component.groupingButtonLabel(statusColumn)).toBe('Group by this column');
    component.groupByColumns.set(['status']);
    expect(component.groupingButtonLabel(statusColumn)).toBe('Remove grouping');

    expect(component.filterValue('status')).toBe('');
    component.activeFilters.set({ status: 'Active' });
    expect(component.filterValue('status')).toBe('Active');
    expect(component.filterPlaceholder(statusColumn)).toBe('Filter…');
    expect(component.filterPlaceholder({ ...statusColumn, filterable: false })).toBe(
      'Filter disabled',
    );
    expect(component.isFilterInputDisabled(statusColumn)).toBe(false);
    expect(component.isFilterInputDisabled({ ...statusColumn, filterable: false })).toBe(true);

    expect(component.groupDisclosureLabel({ collapsed: false })).toBe('Collapse group');
    expect(component.groupDisclosureLabel({ collapsed: true })).toBe('Expand group');

    component.expandedTreeRows.set({ [statusRow.id]: true });
    expect(component.treeToggleLabel(statusRow)).toBe('Collapse row');
    expect(component.isTreeRowExpanded(statusRow)).toBe(true);
    component.expandedTreeRows.set({});
    expect(component.treeToggleLabel(statusRow)).toBe('Expand row');
    expect(component.isTreeRowExpanded(statusRow)).toBe(false);

    statusRow.expanded = true;
    expect(component.expandToggleLabel(statusRow)).toBe('Collapse details');
    statusRow.expanded = false;
    expect(component.expandToggleLabel(statusRow)).toBe('Expand details');
  });

  it('resolves custom i18n label overrides while keeping defaults for unset keys', () => {
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({
        labels: {
          sortDefault: 'Trier',
          sortAsc: 'Tri croissant',
          paginationNext: 'Suivant',
        },
      }),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    const labels = component.labels();

    expect(labels.sortDefault).toBe('Trier');
    expect(labels.sortAsc).toBe('Tri croissant');
    expect(labels.paginationNext).toBe('Suivant');
    expect(labels.sortDesc).toBe('Sort descending');
    expect(labels.groupColumn).toBe('Group by this column');
    expect(labels.filterPlaceholder).toBe('Filter…');
    expect(labels.emptyHeading).toBe('No matching rows');
  });

  it('supports keyboard-driven cell editing with commit, navigation, and cancel events', async () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          enableGrouping: false,
          enableCellEditOnFocus: true,
          columnDefs: [
            { name: 'name', displayName: 'Customer', enableCellEdit: true },
            { name: 'status' },
            { name: 'owner', field: 'account.owner', enableCellEdit: true },
          ],
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const beginCellEdit = vi.fn();
    const afterCellEdit = vi.fn();
    const cancelCellEdit = vi.fn();
    gridApi.edit.on.beginCellEdit(beginCellEdit);
    gridApi.edit.on.afterCellEdit(afterCellEdit);
    gridApi.edit.on.cancelCellEdit(cancelCellEdit);

    const shadowRoot = getShadowRoot(fixture);
    const firstNameCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="name"]',
    ) as HTMLElement;
    firstNameCell.focus();
    firstNameCell.dispatchEvent(keyDown(firstNameCell, { key: 'Z' }));
    fixture.detectChanges();
    await fixture.whenStable();

    let editor = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="name"]',
    ) as HTMLInputElement;
    expect(editor.value).toBe('Z');
    expect(beginCellEdit).toHaveBeenCalled();

    editor.dispatchEvent(keyDown(editor, { key: 'Tab' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(gridApi.core.getVisibleRows()[0]?.entity['name']).toBe('Z');
    expect(afterCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'row-1', name: 'Z' }),
      expect.objectContaining({ name: 'name' }),
      'Z',
      'Gamma',
    );

    expect(
      shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="status"]'),
    ).toBeNull();
    const statusCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="status"]',
    ) as HTMLElement;
    expect(statusCell).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(statusCell);

    statusCell.dispatchEvent(keyDown(statusCell, { key: 'Tab' }));
    fixture.detectChanges();
    await fixture.whenStable();

    const ownerEditor = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="owner"]',
    ) as HTMLInputElement;
    expect(ownerEditor).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(ownerEditor);
    expect(
      shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="name"]'),
    ).toBeNull();

    ownerEditor.dispatchEvent(keyDown(ownerEditor, { key: 'Tab', shiftKey: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const statusCellAgain = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="status"]',
    ) as HTMLElement;
    expect(statusCellAgain).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(statusCellAgain);
    expect(
      shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="owner"]'),
    ).toBeNull();

    statusCellAgain.dispatchEvent(keyDown(statusCellAgain, { key: 'Tab', shiftKey: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const nameEditorAgain = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="name"]',
    ) as HTMLInputElement;
    expect(nameEditorAgain).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(nameEditorAgain);

    nameEditorAgain.dispatchEvent(keyDown(nameEditorAgain, { key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();
    cancelCellEdit.mockClear();

    const ownerCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="owner"]',
    ) as HTMLElement;
    ownerCell.focus();
    ownerCell.dispatchEvent(keyDown(ownerCell, { key: 'F2' }));
    fixture.detectChanges();
    await fixture.whenStable();

    editor = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="owner"]',
    ) as HTMLInputElement;
    expect(editor.value).toBe('Mina Patel');
    editor.value = 'Taylor Morgan';
    editor.dispatchEvent(domEvent(editor, 'input'));
    editor.dispatchEvent(keyDown(editor, { key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(gridApi.core.getVisibleRows()[0]?.entity['account']).toEqual({ owner: 'Mina Patel' });
    expect(cancelCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'row-1' }),
      expect.objectContaining({ name: 'owner' }),
    );
  });

  it('tabs from a non-editable cell to the next editable cell', async () => {
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({
        enableGrouping: false,
        enableCellEditOnFocus: true,
        columnDefs: [
          { name: 'name', displayName: 'Customer', enableCellEdit: true },
          { name: 'status' },
          { name: 'owner', field: 'account.owner', enableCellEdit: true },
        ],
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const shadowRoot = getShadowRoot(fixture);
    const statusCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="status"]',
    ) as HTMLElement;
    statusCell.focus();
    statusCell.dispatchEvent(keyDown(statusCell, { key: 'Tab' }));
    fixture.detectChanges();
    await fixture.whenStable();

    const ownerEditor = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="owner"]',
    ) as HTMLInputElement;
    expect(ownerEditor).toBeTruthy();
    expect(ownerEditor.value).toBe('Mina Patel');
    expect(
      shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="status"]'),
    ).toBeNull();
  });

  it('keeps the destination cell selected when Tab opens its editor', async () => {
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({
        enableGrouping: false,
        enableCellEditOnFocus: true,
        columnDefs: [
          { name: 'name' },
          { name: 'owner', field: 'account.owner', enableCellEdit: true },
        ],
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const shadowRoot = getShadowRoot(fixture);
    const nameCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="name"]',
    ) as HTMLElement;
    nameCell.focus();
    nameCell.dispatchEvent(keyDown(nameCell, { key: 'Tab', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const ownerCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="owner"]',
    ) as HTMLElement;
    const ownerEditor = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="owner"]',
    ) as HTMLInputElement;
    expect(ownerCell.classList.contains('cell-focused')).toBe(true);
    expect(ownerCell.classList.contains('cell-editing')).toBe(true);
    expect(ownerEditor).toBeTruthy();
  });

  it('commits editor changes and navigates vertically on ArrowUp and ArrowDown', async () => {
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({
        enableGrouping: false,
        enableCellEditOnFocus: true,
        columnDefs: [
          { name: 'name', enableCellEdit: true },
          { name: 'status' },
        ],
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const shadowRoot = getShadowRoot(fixture);
    const firstRowNameCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="name"]',
    ) as HTMLElement;
    firstRowNameCell.focus();
    firstRowNameCell.dispatchEvent(keyDown(firstRowNameCell, { key: 'F2', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    let editor = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="name"]',
    ) as HTMLInputElement;
    expect(editor).toBeTruthy();
    editor.value = 'Renamed Customer';
    editor.dispatchEvent(domEvent(editor, 'input'));
    editor.dispatchEvent(keyDown(editor, { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const secondRowEditor = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-2"][data-col-name="name"]',
    ) as HTMLInputElement;
    expect(secondRowEditor).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(secondRowEditor);

    const secondRowNameCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-2"][data-col-name="name"]',
    ) as HTMLElement;
    secondRowEditor.dispatchEvent(keyDown(secondRowEditor, { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    editor = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="name"]',
    ) as HTMLInputElement;
    expect(editor).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(editor);
    expect(secondRowNameCell.classList.contains('row-focused')).toBe(false);
  });

  it('moves the focused-row highlight when keyboard navigation changes rows', async () => {
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({
        enableGrouping: false,
        enableCellEditOnFocus: false,
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const shadowRoot = getShadowRoot(fixture);
    const firstRowNameCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="name"]',
    ) as HTMLElement;
    const secondRowNameCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-2"][data-col-name="name"]',
    ) as HTMLElement;

    firstRowNameCell.focus();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      shadowRoot.querySelectorAll('.body-cell[data-row-id="row-1"].row-focused').length,
    ).toBeGreaterThan(1);
    expect(shadowRoot.querySelectorAll('.body-cell[data-row-id="row-2"].row-focused')).toHaveLength(0);

    firstRowNameCell.dispatchEvent(keyDown(firstRowNameCell, { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(shadowRoot.querySelectorAll('.body-cell[data-row-id="row-1"].row-focused')).toHaveLength(0);
    expect(
      shadowRoot.querySelectorAll('.body-cell[data-row-id="row-2"].row-focused').length,
    ).toBeGreaterThan(1);
    expect(shadowRoot.activeElement).toBe(secondRowNameCell);
  });

  it('stops handled keyboard navigation from bubbling to parent listeners', async () => {
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({
        enableGrouping: false,
        enableCellEditOnFocus: true,
        columnDefs: [
          { name: 'name', displayName: 'Customer', enableCellEdit: true },
          { name: 'status' },
          { name: 'owner', field: 'account.owner', enableCellEdit: true },
        ],
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const shadowRoot = getShadowRoot(fixture);
    const host = fixture.nativeElement as HTMLElement;
    const parentKeydown = vi.fn();
    host.addEventListener('keydown', parentKeydown);

    const firstNameCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="name"]',
    ) as HTMLElement;
    firstNameCell.focus();
    firstNameCell.dispatchEvent(keyDown(firstNameCell, { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(parentKeydown).not.toHaveBeenCalled();
    expect(shadowRoot.activeElement).toBe(
      shadowRoot.querySelector('.body-cell[data-row-id="row-1"][data-col-name="status"]'),
    );

    const statusCell = shadowRoot.querySelector(
      '.body-cell[data-row-id="row-1"][data-col-name="status"]',
    ) as HTMLElement;
    statusCell.dispatchEvent(keyDown(statusCell, { key: 'Tab', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(parentKeydown).not.toHaveBeenCalled();
    const ownerEditor = shadowRoot.querySelector(
      '.cell-editor[data-row-id="row-1"][data-col-name="owner"]',
    ) as HTMLInputElement;
    expect(ownerEditor).toBeTruthy();

    ownerEditor.dispatchEvent(keyDown(ownerEditor, { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(parentKeydown).not.toHaveBeenCalled();
  });

  it('exercises edit api wrappers, parser fallbacks, and refresh cloning deterministically', async () => {
    let gridApi!: UiGridApi;
    const editData = [
      {
        id: 'row-1',
        revenue: 100,
        enabled: false,
        renewal: '2026-01-01',
        account: { owner: 'Mina Patel' },
        locked: 'read-only',
      },
    ];
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          data: editData,
          enableGrouping: false,
          enableCellEdit: true,
          columnDefs: [
            { name: 'revenue', type: 'number', enableCellEdit: true },
            { name: 'enabled', type: 'boolean', enableCellEdit: true },
            { name: 'renewal', type: 'date', enableCellEdit: true },
            { name: 'owner', field: 'account.owner', enableCellEdit: true },
            { name: 'locked', enableCellEdit: false },
          ],
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as any;
    component.activeFilters.set({ enabled: 'true' });
    const previousFilters = component.activeFilters();

    gridApi.core.refresh();
    expect(component.activeFilters()).toEqual(previousFilters);
    expect(component.activeFilters()).not.toBe(previousFilters);

    expect(gridApi.edit.getEditingCell()).toBeNull();
    gridApi.edit.endCellEdit();
    gridApi.edit.cancelCellEdit();

    gridApi.edit.beginCellEdit('missing', 'owner');
    gridApi.edit.beginCellEdit('row-1', 'missing');
    gridApi.edit.beginCellEdit('row-1', 'locked');
    expect(gridApi.edit.getEditingCell()).toBeNull();

    gridApi.edit.beginCellEdit('row-1', 'revenue');
    expect(gridApi.edit.getEditingCell()).toEqual({ rowId: 'row-1', columnName: 'revenue' });
    component.editingValue.set('oops');
    gridApi.edit.endCellEdit();
    expect(editData[0]?.revenue).toBe(100);

    gridApi.edit.beginCellEdit('row-1', 'enabled');
    component.editingValue.set('true');
    gridApi.edit.endCellEdit();
    expect(editData[0]?.enabled).toBe(true);

    gridApi.edit.beginCellEdit('row-1', 'renewal');
    component.editingValue.set('2026-02-02');
    gridApi.edit.endCellEdit();
    expect(editData[0]?.renewal).toBe('2026-02-02');

    gridApi.edit.beginCellEdit('row-1', 'owner');
    component.editingValue.set('Taylor Morgan');
    gridApi.edit.endCellEdit();
    expect(editData[0]?.account.owner).toBe('Taylor Morgan');
    expect(gridApi.edit.getEditingCell()).toBeNull();

    const visibleColumns = component.visibleColumns();
    expect(component.moveFocus({ id: 'missing-row' }, visibleColumns[0], 'right')).toBe(false);
    expect(component.moveFocus(gridApi.core.getVisibleRows()[0], visibleColumns[0], 'left')).toBe(
      false,
    );
    expect(component.moveFocus(gridApi.core.getVisibleRows()[0], visibleColumns[0], 'up')).toBe(
      false,
    );

    expect(component.stringifyEditorValue(new Date('2026-02-03T00:00:00.000Z'))).toBe('2026-02-03');
    expect(component.stringifyEditorValue(undefined)).toBe('');
  });

  it('supports expandable rows while using the virtualized rendering path', async () => {
    const fixture = TestBed.createComponent(VirtualExpandableHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const gridApi = fixture.componentInstance.gridApi()!;
    const rootElement = fixture.nativeElement as HTMLElement;
    const gridHost = rootElement.querySelector('app-ui-grid') as HTMLElement;
    const shadowRoot = gridHost.shadowRoot!;
    expect(shadowRoot.querySelector('.grid-virtual-spacer')).not.toBeNull();

    gridApi.expandable.expandAllRows();
    fixture.detectChanges();

    expect(gridApi.core.getVisibleRows()).toHaveLength(6);
  });

  it('uses overflow-capable default grid tracks so pinned columns can stick inside a horizontal scroller', () => {
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({
        enablePinning: true,
        columnDefs: [
          { name: 'name', displayName: 'Customer', pinnedLeft: true },
          { name: 'status' },
          { name: 'revenue', align: 'end' },
        ],
      }),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    expect(component.gridTemplateColumns()).toContain('minmax(11rem, 1fr)');
  });

  it('appends pinned columns in click order and returns unpinned columns to the normal area', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          enablePinning: true,
          columnDefs: [
            { name: 'name', displayName: 'Customer' },
            { name: 'status' },
            { name: 'revenue', align: 'end' },
            { name: 'owner', field: 'account.owner' },
          ],
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    expect(component.visibleColumns().map((column: GridColumnDef) => column.name)).toEqual([
      'name',
      'status',
      'revenue',
      'owner',
    ]);

    gridApi.pinning.pinColumn('revenue', 'left');
    fixture.detectChanges();
    gridApi.pinning.pinColumn('owner', 'left');
    fixture.detectChanges();

    expect(component.visibleColumns().map((column: GridColumnDef) => column.name)).toEqual([
      'revenue',
      'owner',
      'name',
      'status',
    ]);

    gridApi.pinning.pinColumn('revenue', 'none');
    fixture.detectChanges();

    expect(component.visibleColumns().map((column: GridColumnDef) => column.name)).toEqual([
      'owner',
      'name',
      'status',
      'revenue',
    ]);
  });

  it('opens a left-right pin menu for unpinned columns and unpins directly from an active pin button', () => {
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({
        enablePinning: true,
        columnDefs: [
          { name: 'name', displayName: 'Customer' },
          { name: 'status' },
          { name: 'revenue', align: 'end' },
        ],
      }),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    const shadowRoot = getShadowRoot(fixture);
    const pinToggleFor = (headerLabel: string): HTMLButtonElement => {
      const headerCell = [...shadowRoot.querySelectorAll('.header-cell')].find(
        (node) => node.querySelector('.header-label')?.textContent?.trim() === headerLabel,
      ) as HTMLElement | undefined;

      if (!headerCell) {
        throw new Error(`Missing header cell for ${headerLabel}`);
      }

      return headerCell.querySelector('[part="pin-toggle"]') as HTMLButtonElement;
    };

    pinToggleFor('Customer').click();
    fixture.detectChanges();

    const customerHeader = [...shadowRoot.querySelectorAll('.header-cell')].find(
      (node) => node.querySelector('.header-label')?.textContent?.trim() === 'Customer',
    ) as HTMLElement;
    const customerMenu = customerHeader.querySelector('[part="pin-menu"]') as HTMLElement;
    expect(customerHeader.classList.contains('is-pin-menu-open')).toBe(true);
    expect(
      customerHeader.querySelector('.pin-control')?.classList.contains('pin-control-open'),
    ).toBe(true);
    expect(customerMenu.getAttribute('aria-hidden')).toBe('false');
    expect(customerHeader.querySelector('[part="pin-left-action"]')).not.toBeNull();
    expect(customerHeader.querySelector('[part="pin-right-action"]')).not.toBeNull();

    (customerHeader.querySelector('[part="pin-left-action"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.pinnedColumns()).toMatchObject({ name: 'left' });
    expect(customerHeader.classList.contains('is-pin-menu-open')).toBe(false);
    expect(
      customerHeader.querySelector('.pin-control')?.classList.contains('pin-control-open'),
    ).toBe(false);
    expect(customerMenu.getAttribute('aria-hidden')).toBe('true');

    pinToggleFor('Customer').click();
    fixture.detectChanges();

    expect(component.pinnedColumns().name).toBeUndefined();
    expect(customerHeader.classList.contains('is-pin-menu-open')).toBe(false);
    expect(
      customerHeader.querySelector('.pin-control')?.classList.contains('pin-control-open'),
    ).toBe(false);

    pinToggleFor('Status').click();
    fixture.detectChanges();
    const statusHeader = [...shadowRoot.querySelectorAll('.header-cell')].find(
      (node) => node.querySelector('.header-label')?.textContent?.trim() === 'Status',
    ) as HTMLElement;
    const statusMenu = statusHeader.querySelector('[part="pin-menu"]') as HTMLElement;
    expect(statusHeader.classList.contains('is-pin-menu-open')).toBe(true);
    expect(statusMenu.getAttribute('aria-hidden')).toBe('false');

    (statusHeader.querySelector('[part="pin-right-action"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.pinnedColumns()).toMatchObject({ status: 'right' });
    expect(statusHeader.classList.contains('is-pin-menu-open')).toBe(false);
    expect(statusMenu.getAttribute('aria-hidden')).toBe('true');
  });

  it('raises infinite scroll load events near the top and bottom of the viewport', async () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          data: Array.from({ length: 8 }, (_value, index) => ({
            id: `row-${index + 1}`,
            name: `Row ${index + 1}`,
            status: index % 2 === 0 ? 'Active' : 'Pilot',
            revenue: index * 10,
            account: { owner: `Owner ${index + 1}` },
          })),
          virtualizationThreshold: 1,
          minRowsToShow: 1,
          infiniteScrollRowsFromEnd: 1,
          infiniteScrollUp: true,
          infiniteScrollDown: true,
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const needMoreTop = vi.fn();
    const needMoreBottom = vi.fn();
    gridApi.infiniteScroll.on.needLoadMoreDataTop(needMoreTop);
    gridApi.infiniteScroll.on.needLoadMoreData(needMoreBottom);

    (fixture.componentInstance as any).onViewportIndexChange(0);
    expect(needMoreTop).toHaveBeenCalledTimes(1);

    await gridApi.infiniteScroll.dataLoaded(true, true);
    (fixture.componentInstance as any).onViewportIndexChange(7);
    expect(needMoreBottom).toHaveBeenCalledTimes(1);
  });

  it('updates infinite scroll helper state through the api', async () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          data: Array.from({ length: 5 }, (_value, index) => ({
            id: `row-${index + 1}`,
            name: `Row ${index + 1}`,
            status: 'Active',
            revenue: index,
            account: { owner: `Owner ${index + 1}` },
          })),
          virtualizationThreshold: 1,
          minRowsToShow: 1,
          infiniteScrollRowsFromEnd: 1,
          infiniteScrollUp: true,
          infiniteScrollDown: true,
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    gridApi.infiniteScroll.setScrollDirections(false, true);
    component.onViewportIndexChange(4);
    expect(component.infiniteScrollState().dataLoading).toBe(true);

    await gridApi.infiniteScroll.dataLoaded(false, false);
    expect(component.infiniteScrollState()).toMatchObject({
      scrollUp: false,
      scrollDown: false,
      dataLoading: false,
    });

    gridApi.infiniteScroll.saveScrollPercentage();
    expect(component.infiniteScrollState().previousVisibleRows).toBe(5);

    gridApi.infiniteScroll.dataRemovedTop(true, false);
    expect(component.infiniteScrollState()).toMatchObject({
      scrollUp: true,
      scrollDown: false,
      previousVisibleRows: 0,
    });

    gridApi.infiniteScroll.dataRemovedBottom(false, true);
    expect(component.infiniteScrollState()).toMatchObject({
      scrollUp: false,
      scrollDown: true,
      previousVisibleRows: 0,
    });

    gridApi.infiniteScroll.resetScroll(true, true);
    expect(component.infiniteScrollState()).toMatchObject({
      scrollUp: true,
      scrollDown: true,
      previousVisibleRows: 0,
    });
  });

  it('raises grid dimension changes through auto resize and updates the fallback viewport height', () => {
    let gridApi!: UiGridApi;
    let resizeCallback: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        observe(): void {}

        disconnect = disconnect;
      },
    );

    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions(
        {
          enableAutoResize: true,
        },
        (api) => {
          gridApi = api;
        },
      ),
    );
    fixture.detectChanges();

    const gridDimensionChanged = vi.fn();
    gridApi.core.on.gridDimensionChanged(gridDimensionChanged);

    resizeCallback?.([], {} as ResizeObserver);
    fixture.detectChanges();
    expect(gridDimensionChanged).not.toHaveBeenCalled();

    resizeCallback?.(
      [
        {
          contentRect: { width: 640, height: 720 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
    fixture.detectChanges();

    expect(gridDimensionChanged).toHaveBeenCalledWith(0, 0, 720, 640);
    expect((fixture.componentInstance as any).viewportHeight()).toBe('720px');

    resizeCallback?.(
      [
        {
          contentRect: { width: 640, height: 720 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
    fixture.detectChanges();
    expect(gridDimensionChanged).toHaveBeenCalledTimes(1);

    fixture.destroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('saves and restores transient grid state through the saveState api', async () => {
    const fixture = TestBed.createComponent(ExpandableHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const gridApi = fixture.componentInstance.gridApi()!;
    gridApi.core.setFilter('status', 'Active');
    gridApi.core.sortColumn('name', SORT_DIRECTIONS.desc);
    gridApi.core.groupByColumn('status');
    gridApi.expandable.expandAllRows();
    const saved = gridApi.saveState.save();

    gridApi.core.clearAllFilters();
    gridApi.core.clearGrouping();
    gridApi.expandable.collapseAllRows();
    gridApi.saveState.restore(saved);
    fixture.detectChanges();

    expect(saved.filters).toEqual({ status: 'Active' });
    expect(saved.sort).toEqual({ columnName: 'name', direction: SORT_DIRECTIONS.desc });
    expect(saved.grouping).toEqual(['status']);
    expect(saved.expandable).toBeTruthy();
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual([
      'Beta',
      'alpha',
    ]);
  });

  it('ignores malformed values when restoring saved state', async () => {
    const fixture = TestBed.createComponent(ExpandableHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const gridApi = fixture.componentInstance.gridApi()!;
    gridApi.saveState.restore({
      columnOrder: ['status', '__proto__' as never, 1 as never],
      filters: { status: 'Active', count: 1 as never } as never,
      sort: { columnName: 'name', direction: SORT_DIRECTIONS.asc, extra: 'ignored' } as never,
      grouping: ['status', 123 as never],
      pagination: { paginationCurrentPage: -3, paginationPageSize: 25 } as never,
      expandable: { row1: true, row2: 'yes' as never },
      treeView: { row3: false, row4: 1 as never },
    });

    const saved = gridApi.saveState.save();
    expect(saved.columnOrder).toEqual(['status']);
    expect(saved.filters).toEqual({ status: 'Active' });
    expect(saved.grouping).toEqual(['status']);
    expect(saved.expandable).toEqual({ row1: true });
    expect(saved.treeView).toEqual({ row3: false });
  });

  it('fires benchmark and export actions from the api and updates benchmark metrics', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput(
      'options',
      createOptions({}, (api) => {
        gridApi = api;
      }),
    );
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    const benchmarkSpy = vi.spyOn(component, 'runBenchmark');
    const exportSpy = vi.spyOn(component, 'exportCsv');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:toolbar');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    gridApi.core.benchmark();
    gridApi.core.exportCsv();

    expect(benchmarkSpy).toHaveBeenCalled();
    expect(exportSpy).toHaveBeenCalled();
    expect(component.benchmarkResult()).not.toBeNull();
    expect(component.benchmarkResult()?.averageMs).toBeGreaterThanOrEqual(0);
  });
});
