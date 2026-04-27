import { Component, TemplateRef, computed, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FILTER_CONDITIONS, SORT_DIRECTIONS } from './grid.constants';
import { UiGridApi } from './grid.api';
import { GridExpandableTemplateContext, GridOptions } from './grid.models';
import { UiGridComponent } from './ui-grid.component';

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

@Component({
  imports: [UiGridComponent],
  template: `
    <ng-template #detail let-row>
      <div class="detail-row">{{ row.name }} detail</div>
    </ng-template>
    <app-ui-grid [options]="options()" />
  `
})
class ExpandableHostComponent {
  private readonly registeredApi = signal<UiGridApi | null>(null);
  private readonly detailTemplate = viewChild.required<TemplateRef<GridExpandableTemplateContext>>('detail');

  readonly options = computed<GridOptions>(() => createOptions(
    {
      enableExpandable: true,
      expandableRowTemplate: this.detailTemplate(),
      virtualizationThreshold: 99
    },
    (api) => this.registeredApi.set(api)
  ));

  readonly gridApi = this.registeredApi;
}

@Component({
  imports: [UiGridComponent],
  template: `
    <ng-template #status let-value>
      <span class="inline-status">{{ value }}</span>
    </ng-template>
    <app-ui-grid [options]="options()" />
  `
})
class CellTemplateHostComponent {
  private readonly registeredApi = signal<UiGridApi | null>(null);
  private readonly statusTemplate = viewChild.required<TemplateRef<unknown>>('status');

  readonly options = computed<GridOptions>(() => createOptions(
    {
      columnDefs: [
        { name: 'name', displayName: 'Customer' },
        { name: 'status', cellTemplate: this.statusTemplate() as TemplateRef<any> }
      ],
      virtualizationThreshold: 99
    },
    (api) => this.registeredApi.set(api)
  ));
}

@Component({
  imports: [UiGridComponent],
  template: `
    <ng-template #detail let-row>
      <div class="virtual-detail">{{ row.name }} virtual detail</div>
    </ng-template>
    <app-ui-grid [options]="options()" />
  `
})
class VirtualExpandableHostComponent {
  private readonly registeredApi = signal<UiGridApi | null>(null);
  private readonly detailTemplate = viewChild.required<TemplateRef<GridExpandableTemplateContext>>('detail');

  readonly options = computed<GridOptions>(() => createOptions(
    {
      data: Array.from({ length: 6 }, (_value, index) => ({
        id: `row-${index + 1}`,
        name: `Row ${index + 1}`,
        status: index % 2 === 0 ? 'Active' : 'Pilot',
        revenue: index * 100,
        account: { owner: `Owner ${index + 1}` }
      })),
      enableExpandable: true,
      expandableRowTemplate: this.detailTemplate(),
      virtualizationThreshold: 1
    },
    (api) => this.registeredApi.set(api)
  ));

  readonly gridApi = this.registeredApi;
}

describe('UiGridComponent', () => {

  function getShadowRoot(fixture: ReturnType<typeof TestBed.createComponent<UiGridComponent>>): ShadowRoot {
    const host = fixture.nativeElement as HTMLElement;
    if (!host.shadowRoot) {
      throw new Error('Expected a shadow root on app-ui-grid');
    }

    return host.shadowRoot;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiGridComponent, ExpandableHostComponent, CellTemplateHostComponent, VirtualExpandableHostComponent]
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

    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const headers = [...shadowRoot.querySelectorAll('.header-label')].map((node) => node.textContent?.trim());
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
    const headers = [...shadowRoot.querySelectorAll('.header-label')].map((node) => node.textContent?.trim());
    expect(columnOrderChanged).toHaveBeenLastCalledWith(['status', 'revenue', 'name', 'owner', 'badge']);
    expect(headers).toEqual(['Status', 'Revenue', 'Customer', 'Owner', 'Badge']);

    (fixture.componentInstance as any).onColumnDrop({
      previousIndex: 1,
      currentIndex: 1,
      item: { data: (fixture.componentInstance as any).visibleColumns()[1] },
      container: { data: (fixture.componentInstance as any).visibleColumns() }
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
            { name: 'badge' }
          ]
        },
        (api) => {
          gridApi = api;
        }
      )
    );
    fixture.detectChanges();

    (fixture.componentInstance as any).onColumnDrop({
      previousIndex: 3,
      currentIndex: 1,
      item: { data: { name: 'badge' } },
      container: { data: (fixture.componentInstance as any).visibleColumns() }
    });
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const headers = [...shadowRoot.querySelectorAll('.header-label')].map((node) => node.textContent?.trim());

    expect(headers).toEqual(['Customer', 'Badge', 'Status', 'Revenue', 'Owner']);
    expect((fixture.componentInstance as any).columnOrder()).toEqual(['id', 'name', 'badge', 'status', 'revenue', 'owner']);
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

  it('keeps a row hidden until all invisible reasons are cleared', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
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
    const headersBefore = [...shadowRoot.querySelectorAll('.header-label')].map((node) => node.textContent?.trim());
    expect(headersBefore).toEqual(['Status', 'Owner']);
    expect(shadowRoot.querySelector('.filter-grid')).toBeNull();
    expect(shadowRoot.querySelector('.chip-action')).toBeNull();
    expect((fixture.componentInstance as any).rowSize()).toBe(44);
    expect((fixture.componentInstance as any).viewportHeight()).toBe('560px');
    expect((fixture.componentInstance as any).isVirtualizationEnabled(100)).toBe(false);

    gridApi.core.setFilter('status', 'Active');
    gridApi.core.sortColumn('status');
    gridApi.core.moveColumn(0, 1);
    gridApi.expandable.toggleRowExpansion(baseData[0]);
    gridApi.expandable.expandAllRows();
    fixture.detectChanges();

    const headersAfter = [...shadowRoot.querySelectorAll('.header-label')].map((node) => node.textContent?.trim());
    expect(headersAfter).toEqual(['Status', 'Owner']);
    expect(gridApi.core.getVisibleRows()).toHaveLength(3);
    expect(shadowRoot.querySelector('.detail-row')).toBeNull();
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

  it('paginates rows and raises pagination events deterministically', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({
      enablePagination: true,
      enablePaginationControls: true,
      paginationPageSizes: [1, 2],
      paginationPageSize: 1,
      paginationCurrentPage: 1
    }, (api) => {
      gridApi = api;
    }));
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
    fixture.componentRef.setInput('options', createOptions({
      data: [],
      enablePagination: true,
      enablePaginationControls: true,
      paginationPageSizes: [1, 2],
      paginationPageSize: 1,
      paginationCurrentPage: 1,
      emptyMessage: 'No data'
    }, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    expect(shadowRoot.querySelector('.pagination-bar p')?.textContent).toContain('0-0 of 0');
    expect(shadowRoot.querySelector('.empty-state strong')?.textContent).toContain('No data');

    (fixture.componentInstance as any).onPageSizeChange('not-a-number');
    fixture.detectChanges();
    expect(gridApi.pagination.getPage()).toBe(1);
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
          { id: 'child-1', name: 'Child 1', status: 'Pilot', revenue: 150, account: { owner: 'Owner 1A' } },
          { id: 'child-2', name: 'Child 2', status: 'Pilot', revenue: 180, account: { owner: 'Owner 1B' } }
        ]
      },
      {
        id: 'parent-2',
        name: 'Parent 2',
        status: 'Pilot',
        revenue: 220,
        account: { owner: 'Owner 2' },
        children: []
      }
    ];
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({
      data: treeData,
      enableTreeView: true,
      treeChildrenField: 'children',
      showTreeExpandNoChildren: false,
      enableGrouping: false,
      virtualizationThreshold: 99
    }, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const rowExpanded = vi.fn();
    const rowCollapsed = vi.fn();
    gridApi.treeBase.on.rowExpanded(rowExpanded);
    gridApi.treeBase.on.rowCollapsed(rowCollapsed);

    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'parent-2']);
    expect(gridApi.treeBase.getRowChildren('parent-1').map((row) => row.id)).toEqual(['child-1', 'child-2']);

    gridApi.treeBase.expandRow('parent-1');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'child-1', 'child-2', 'parent-2']);
    expect(rowExpanded).toHaveBeenCalled();

    gridApi.treeView.setTreeView({ 'parent-1': false });
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'parent-2']);
    expect(gridApi.treeView.getTreeView()).toEqual({ 'parent-1': false });

    gridApi.treeBase.toggleRowTreeState('parent-1');
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'child-1', 'child-2', 'parent-2']);

    gridApi.treeBase.collapseRow('parent-1');
    fixture.detectChanges();
    expect(rowCollapsed).toHaveBeenCalled();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'parent-2']);

    gridApi.treeBase.expandAllRows();
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'child-1', 'child-2', 'parent-2']);

    gridApi.treeBase.collapseAllRows();
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'parent-2']);

    const shadowRoot = getShadowRoot(fixture);
    const treeToggle = shadowRoot.querySelector('.row-toggle-tree') as HTMLButtonElement;
    treeToggle.click();
    fixture.detectChanges();
    expect(gridApi.core.getVisibleRows().map((row) => row.id)).toEqual(['parent-1', 'child-1', 'child-2', 'parent-2']);

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
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    const statusColumn = createOptions().columnDefs[1];
    const statusRow = gridApi.core.getVisibleRows()[0];

    expect(component.sortButtonLabel(statusColumn)).toBe('Sort');
    component.sortState.set({ columnName: 'status', direction: SORT_DIRECTIONS.asc });
    expect(component.sortButtonLabel(statusColumn)).toBe('Asc');
    component.sortState.set({ columnName: 'status', direction: SORT_DIRECTIONS.desc });
    expect(component.sortButtonLabel(statusColumn)).toBe('Desc');

    expect(component.groupingButtonLabel(statusColumn)).toBe('Group');
    component.groupByColumns.set(['status']);
    expect(component.groupingButtonLabel(statusColumn)).toBe('Grouped');

    expect(component.filterValue('status')).toBe('');
    component.activeFilters.set({ status: 'Active' });
    expect(component.filterValue('status')).toBe('Active');
    expect(component.filterPlaceholder(statusColumn)).toBe('Filter…');
    expect(component.filterPlaceholder({ ...statusColumn, filterable: false })).toBe('Filter disabled');
    expect(component.isFilterInputDisabled(statusColumn)).toBe(false);
    expect(component.isFilterInputDisabled({ ...statusColumn, filterable: false })).toBe(true);

    expect(component.groupDisclosureLabel({ collapsed: false })).toBe('Collapse');
    expect(component.groupDisclosureLabel({ collapsed: true })).toBe('Expand');

    component.expandedTreeRows.set({ [statusRow.id]: true });
    expect(component.treeToggleSymbol(statusRow)).toBe('−');
    component.expandedTreeRows.set({});
    expect(component.treeToggleSymbol(statusRow)).toBe('+');

    statusRow.expanded = true;
    expect(component.expandToggleSymbol(statusRow)).toBe('▾');
    statusRow.expanded = false;
    expect(component.expandToggleSymbol(statusRow)).toBe('▸');
  });

  it('supports keyboard-driven cell editing with commit, navigation, and cancel events', async () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({
      enableGrouping: false,
      enableCellEditOnFocus: true,
      columnDefs: [
        { name: 'name', displayName: 'Customer', enableCellEdit: true },
        { name: 'status' },
        { name: 'owner', field: 'account.owner', enableCellEdit: true }
      ]
    }, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();
    await fixture.whenStable();

    const beginCellEdit = vi.fn();
    const afterCellEdit = vi.fn();
    const cancelCellEdit = vi.fn();
    gridApi.edit.on.beginCellEdit(beginCellEdit);
    gridApi.edit.on.afterCellEdit(afterCellEdit);
    gridApi.edit.on.cancelCellEdit(cancelCellEdit);

    const shadowRoot = getShadowRoot(fixture);
    const firstNameCell = shadowRoot.querySelector('.body-cell[data-row-id="row-1"][data-col-name="name"]') as HTMLElement;
    firstNameCell.focus();
    firstNameCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z' }));
    fixture.detectChanges();
    await fixture.whenStable();

    let editor = shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="name"]') as HTMLInputElement;
    expect(editor.value).toBe('Z');
    expect(beginCellEdit).toHaveBeenCalled();

    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(gridApi.core.getVisibleRows()[0]?.entity['name']).toBe('Z');
    expect(afterCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'row-1', name: 'Z' }),
      expect.objectContaining({ name: 'name' }),
      'Z',
      'Gamma'
    );

    expect(shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="status"]')).toBeNull();
    const statusCell = shadowRoot.querySelector('.body-cell[data-row-id="row-1"][data-col-name="status"]') as HTMLElement;
    expect(statusCell).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(statusCell);

    statusCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    fixture.detectChanges();
    await fixture.whenStable();

    const ownerEditor = shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="owner"]') as HTMLInputElement;
    expect(ownerEditor).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(ownerEditor);
    expect(shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="name"]')).toBeNull();

    ownerEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const statusCellAgain = shadowRoot.querySelector('.body-cell[data-row-id="row-1"][data-col-name="status"]') as HTMLElement;
    expect(statusCellAgain).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(statusCellAgain);
    expect(shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="owner"]')).toBeNull();

    statusCellAgain.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const nameEditorAgain = shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="name"]') as HTMLInputElement;
    expect(nameEditorAgain).toBeTruthy();
    expect(shadowRoot.activeElement).toBe(nameEditorAgain);

    nameEditorAgain.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();
    cancelCellEdit.mockClear();

    const ownerCell = shadowRoot.querySelector('.body-cell[data-row-id="row-1"][data-col-name="owner"]') as HTMLElement;
    ownerCell.focus();
    ownerCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' }));
    fixture.detectChanges();
    await fixture.whenStable();

    editor = shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="owner"]') as HTMLInputElement;
    expect(editor.value).toBe('Mina Patel');
    editor.value = 'Taylor Morgan';
    editor.dispatchEvent(new Event('input'));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(gridApi.core.getVisibleRows()[0]?.entity['account']).toEqual({ owner: 'Mina Patel' });
    expect(cancelCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'row-1' }),
      expect.objectContaining({ name: 'owner' })
    );
  });

  it('tabs from a non-editable cell to the next editable cell', async () => {
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({
      enableGrouping: false,
      enableCellEditOnFocus: true,
      columnDefs: [
        { name: 'name', displayName: 'Customer', enableCellEdit: true },
        { name: 'status' },
        { name: 'owner', field: 'account.owner', enableCellEdit: true }
      ]
    }));
    fixture.detectChanges();
    await fixture.whenStable();

    const shadowRoot = getShadowRoot(fixture);
    const statusCell = shadowRoot.querySelector('.body-cell[data-row-id="row-1"][data-col-name="status"]') as HTMLElement;
    statusCell.focus();
    statusCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    fixture.detectChanges();
    await fixture.whenStable();

    const ownerEditor = shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="owner"]') as HTMLInputElement;
    expect(ownerEditor).toBeTruthy();
    expect(ownerEditor.value).toBe('Mina Patel');
    expect(shadowRoot.querySelector('.cell-editor[data-row-id="row-1"][data-col-name="status"]')).toBeNull();
  });

  it('supports expandable rows while using the virtualized rendering path', async () => {
    const fixture = TestBed.createComponent(VirtualExpandableHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const gridApi = fixture.componentInstance.gridApi()!;
    const rootElement = fixture.nativeElement as HTMLElement;
    const gridHost = rootElement.querySelector('app-ui-grid') as HTMLElement;
    const shadowRoot = gridHost.shadowRoot!;
    expect(shadowRoot.querySelector('cdk-virtual-scroll-viewport')).not.toBeNull();

    gridApi.expandable.expandAllRows();
    fixture.detectChanges();

    expect(gridApi.core.getVisibleRows()).toHaveLength(6);
  });

  it('raises infinite scroll load events near the top and bottom of the viewport', async () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({
      data: Array.from({ length: 8 }, (_value, index) => ({
        id: `row-${index + 1}`,
        name: `Row ${index + 1}`,
        status: index % 2 === 0 ? 'Active' : 'Pilot',
        revenue: index * 10,
        account: { owner: `Owner ${index + 1}` }
      })),
      virtualizationThreshold: 1,
      viewportHeight: 44,
      infiniteScrollRowsFromEnd: 1,
      infiniteScrollUp: true,
      infiniteScrollDown: true
    }, (api) => {
      gridApi = api;
    }));
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
    fixture.componentRef.setInput('options', createOptions({
      data: Array.from({ length: 5 }, (_value, index) => ({
        id: `row-${index + 1}`,
        name: `Row ${index + 1}`,
        status: 'Active',
        revenue: index,
        account: { owner: `Owner ${index + 1}` }
      })),
      virtualizationThreshold: 1,
      viewportHeight: 44,
      infiniteScrollRowsFromEnd: 1,
      infiniteScrollUp: true,
      infiniteScrollDown: true
    }, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    gridApi.infiniteScroll.setScrollDirections(false, true);
    component.onViewportIndexChange(4);
    expect(component.infiniteScrollState().dataLoading).toBe(true);

    await gridApi.infiniteScroll.dataLoaded(false, false);
    expect(component.infiniteScrollState()).toMatchObject({ scrollUp: false, scrollDown: false, dataLoading: false });

    gridApi.infiniteScroll.saveScrollPercentage();
    expect(component.infiniteScrollState().previousVisibleRows).toBe(5);

    gridApi.infiniteScroll.dataRemovedTop(true, false);
    expect(component.infiniteScrollState()).toMatchObject({ scrollUp: true, scrollDown: false, previousVisibleRows: 0 });

    gridApi.infiniteScroll.dataRemovedBottom(false, true);
    expect(component.infiniteScrollState()).toMatchObject({ scrollUp: false, scrollDown: true, previousVisibleRows: 0 });
  });

  it('raises grid dimension changes through auto resize and updates the fallback viewport height', () => {
    let gridApi!: UiGridApi;
    let resizeCallback: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();

    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(): void {}

      disconnect = disconnect;
    });

    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({
      enableAutoResize: true,
      viewportHeight: undefined
    }, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const gridDimensionChanged = vi.fn();
    gridApi.core.on.gridDimensionChanged(gridDimensionChanged);

    resizeCallback?.([
      {
        contentRect: { width: 640, height: 720 } as DOMRectReadOnly
      } as ResizeObserverEntry
    ], {} as ResizeObserver);
    fixture.detectChanges();

    expect(gridDimensionChanged).toHaveBeenCalledWith(0, 0, 720, 640);
    expect((fixture.componentInstance as any).viewportHeight()).toBe('720px');
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
    expect(gridApi.core.getVisibleRows().map((row) => row.entity['name'])).toEqual(['Beta', 'alpha']);
  });

  it('fires toolbar actions from the template and updates benchmark metrics', () => {
    let gridApi!: UiGridApi;
    const fixture = TestBed.createComponent(UiGridComponent);
    fixture.componentRef.setInput('options', createOptions({}, (api) => {
      gridApi = api;
    }));
    fixture.detectChanges();

    const shadowRoot = getShadowRoot(fixture);
    const component = fixture.componentInstance as any;
    const benchmarkSpy = vi.spyOn(component, 'runBenchmark');
    const exportSpy = vi.spyOn(component, 'exportCsv');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:toolbar');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    (shadowRoot.querySelector('[part="action benchmark-action"]') as HTMLButtonElement).click();
    (shadowRoot.querySelector('[part="action export-action"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(benchmarkSpy).toHaveBeenCalled();
    expect(exportSpy).toHaveBeenCalled();
    expect(shadowRoot.querySelector('.metrics-strip')?.textContent).not.toContain('—');
  });
});