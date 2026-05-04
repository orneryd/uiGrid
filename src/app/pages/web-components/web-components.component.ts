import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FILTER_CONDITIONS,
  type GridBenchmarkResult,
  type GridOptions,
  type GridRecord,
  type UiGridApi,
} from '@ornery/ui-grid-core';
import { defineStandaloneUiGridElement, type VanillaUiGridElement } from '@ornery/ui-grid-vanilla';
import { CodeBlockComponent } from '../shared/code-block.component';
import { createDemoData } from '../shared/demo-data';
import {
  TradingLcg,
  TradingRow,
  createTradingRows,
  tickTradingRows,
  tradingColumnDefs,
} from '../shared/trading-data';

type DemoMode = 'expandable' | 'tree' | 'templated' | 'pinning' | 'trading';

type WebComponentGridElement = VanillaUiGridElement & {
  getState(): unknown;
  setState(state: unknown): void;
};

function createHarnessRows(count = 18): GridRecord[] {
  return Array.from({ length: count }, (_value, index) => ({
    id: `harness-row-${index + 1}`,
    name: `Harness Row ${index + 1}`,
    status: index % 3 === 0 ? 'Active' : index % 3 === 1 ? 'Pilot' : 'Expansion',
    revenue: 1200 + index * 75,
    renewalDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    account: { owner: `Owner ${index + 1}` },
  }));
}

function createTreeRows(): GridRecord[] {
  return Array.from({ length: 6 }, (_value, index) => ({
    id: `parent-${index + 1}`,
    name: `Parent ${index + 1}`,
    status: index % 2 === 0 ? 'Active' : 'Pilot',
    revenue: 3000 + index * 225,
    account: { owner: `Tree Owner ${index + 1}` },
    children: [
      {
        id: `parent-${index + 1}-child-1`,
        name: `Child ${index + 1}.1`,
        status: 'Expansion',
        revenue: 700 + index * 50,
        account: { owner: `Tree Owner ${index + 1}A` },
      },
      {
        id: `parent-${index + 1}-child-2`,
        name: `Child ${index + 1}.2`,
        status: 'Pilot',
        revenue: 900 + index * 60,
        account: { owner: `Tree Owner ${index + 1}B` },
      },
    ],
  }));
}

@Component({
  selector: 'app-web-components-page',
  imports: [RouterLink, CodeBlockComponent],
  templateUrl: './web-components.component.html',
  styleUrl: './web-components.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class WebComponentsComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly primaryGridRef =
    viewChild.required<ElementRef<WebComponentGridElement>>('primaryGrid');
  private readonly demoGridRef =
    viewChild.required<ElementRef<WebComponentGridElement>>('demoGrid');
  private savedGridState: unknown = null;
  private readonly primaryData = createDemoData();
  private primaryGridApi: UiGridApi | null = null;
  private disposePrimaryVisibleRows: (() => void) | null = null;
  private disposePrimaryBenchmark: (() => void) | null = null;
  private tradingRows: TradingRow[] = createTradingRows();
  private readonly tradingRng = new TradingLcg(0x1a2b3c4d);
  private tradingIntervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly mode = signal<DemoMode>('expandable');
  protected readonly visibleRowCount = signal(0);
  protected readonly benchmarkResult = signal<GridBenchmarkResult | null>(null);
  protected readonly savedStateJson = signal('No saved state captured yet.');
  protected readonly totalRows = signal(this.primaryData.length);
  protected readonly webComponentPrimarySnippet = `import { defineStandaloneUiGridElement } from '@ornery/ui-grid-vanilla';
import { FILTER_CONDITIONS, type GridOptions } from '@ornery/ui-grid-core';

await defineStandaloneUiGridElement();

const grid = document.querySelector('ui-grid-element');

const options: GridOptions = {
  id: 'ui-grid-web-components-primary',
  data: createDemoData(),
  rowHeight: 48,
  viewportHeight: 620,
  enableSorting: true,
  enableFiltering: true,
  enableGrouping: true,
  enableColumnMoving: true,
  enableVirtualization: true,
  enableCellEditOnFocus: true,
  virtualizationThreshold: 25,
  grouping: { groupBy: ['status'] },
  rowIdentity: (row) => String(row['id']),
  columnDefs: [
    { name: 'name', displayName: 'Customer', enableCellEdit: true },
    { name: 'company', enableCellEdit: true },
    {
      name: 'revenue',
      type: 'number',
      align: 'end',
      filter: { condition: FILTER_CONDITIONS.greaterThan },
    },
    { name: 'status', filter: { condition: FILTER_CONDITIONS.exact } },
    { name: 'renewalDate', type: 'date', displayName: 'Renewal' },
    { name: 'owner', field: 'account.owner', displayName: 'Account Owner' },
  ],
};

grid.options = options;`;
  protected readonly webComponentPinningSnippet = `grid.options = {
  id: 'web-components-demo-pinning',
  data,
  rowHeight: 46,
  viewportHeight: 300,
  enableSorting: true,
  enableFiltering: true,
  enablePinning: true,
  enableVirtualization: true,
  virtualizationThreshold: 1,
  columnDefs: [
    { name: 'name', displayName: 'Name', width: '160px', pinnedLeft: true },
    { name: 'department', displayName: 'Department', width: '180px' },
    { name: 'region', displayName: 'Region', width: '140px' },
    { name: 'q1', displayName: 'Q1 Revenue', width: '180px', align: 'end' },
    { name: 'q2', displayName: 'Q2 Revenue', width: '180px', align: 'end' },
    { name: 'q3', displayName: 'Q3 Revenue', width: '180px', align: 'end' },
    { name: 'q4', displayName: 'Q4 Revenue', width: '180px', align: 'end' },
    { name: 'total', displayName: 'Total', width: '150px', align: 'end' },
    { name: 'growth', displayName: 'Growth', width: '140px', align: 'end' },
    { name: 'status', displayName: 'Status', width: '150px' },
  ],
};`;
  protected readonly scenarios = [
    { label: 'Expandable', value: 'expandable' as const },
    { label: 'Tree', value: 'tree' as const },
    { label: 'Templated', value: 'templated' as const },
    { label: 'Pinning', value: 'pinning' as const },
    { label: 'Trading', value: 'trading' as const },
  ];

  constructor() {
    afterNextRender(async () => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      await defineStandaloneUiGridElement();
      this.mountPrimaryGrid();
      this.mountDemoGrid();
    });

    inject(DestroyRef).onDestroy(() => {
      this.disposePrimaryVisibleRows?.();
      this.disposePrimaryBenchmark?.();
      this.disposePrimaryVisibleRows = null;
      this.disposePrimaryBenchmark = null;
      this.primaryGridApi = null;
      if (this.tradingIntervalId !== null) {
        clearInterval(this.tradingIntervalId);
        this.tradingIntervalId = null;
      }
    });
  }

  protected setMode(mode: DemoMode): void {
    if (this.mode() === mode) {
      return;
    }

    if (this.tradingIntervalId !== null) {
      clearInterval(this.tradingIntervalId);
      this.tradingIntervalId = null;
    }

    this.mode.set(mode);
    this.mountDemoGrid();

    if (mode === 'trading') {
      this.tradingIntervalId = setInterval(() => {
        this.tradingRows = tickTradingRows(this.tradingRows, this.tradingRng, 6);
        const grid = this.demoGridRef().nativeElement;
        grid.setData(this.tradingRows);
      }, 150);
    }
  }

  protected captureState(): void {
    const grid = this.primaryGridRef().nativeElement;
    this.savedGridState = grid.getState();
    this.savedStateJson.set(JSON.stringify(this.savedGridState, null, 2));
  }

  protected restoreState(): void {
    if (!this.savedGridState) {
      return;
    }

    this.primaryGridRef().nativeElement.setState(this.savedGridState);
  }

  protected resetDemo(): void {
    this.savedGridState = null;
    this.visibleRowCount.set(0);
    this.benchmarkResult.set(null);
    this.savedStateJson.set('No saved state captured yet.');
    this.mountPrimaryGrid();
    this.mountDemoGrid();
  }

  protected runBenchmark(): void {
    this.primaryGridApi?.core.benchmark();
  }

  protected exportCsv(): void {
    this.primaryGridApi?.core.exportCsv();
  }

  private mountPrimaryGrid(): void {
    const grid = this.primaryGridRef().nativeElement;
    this.replaceTemplates(grid, [
      ['cell-status', '<span class="status-pill status-pill-{{valueLower}}">{{value}}</span>'],
    ]);
    this.disposePrimaryVisibleRows?.();
    this.disposePrimaryBenchmark?.();
    this.disposePrimaryVisibleRows = null;
    this.disposePrimaryBenchmark = null;
    this.primaryGridApi = null;
    this.visibleRowCount.set(0);
    this.benchmarkResult.set(null);
    grid.options = this.primaryOptions();
  }

  private mountDemoGrid(): void {
    const grid = this.demoGridRef().nativeElement;
    const mode = this.mode();

    if (mode === 'trading') {
      this.tradingRows = createTradingRows();
      this.replaceTemplates(grid, [
        ['cell-price',     '<span style="color:{{row.priceColor}};font-variant-numeric:tabular-nums">{{row.priceStr}}</span>'],
        ['cell-bid',       '<span style="color:{{row.priceColor}};font-variant-numeric:tabular-nums">{{row.bidStr}}</span>'],
        ['cell-ask',       '<span style="color:{{row.priceColor}};font-variant-numeric:tabular-nums">{{row.askStr}}</span>'],
        ['cell-change',    '<span style="color:{{row.changeColor}}">{{row.changeStr}}</span>'],
        ['cell-changePct', '<span style="color:{{row.changeColor}}">{{row.changePctStr}}</span>'],
      ]);
      grid.options = this.tradingGridOptions();
      return;
    }

    if (mode === 'expandable') {
      this.replaceTemplates(grid, [
        [
          'expandable-row',
          '<article class="detail-card"><strong>{{row.name}}</strong><p>Owner: {{row.account.owner}}</p><p>Renewal: {{row.renewalDate}}</p><p>Revenue: {{row.revenue}}</p></article>',
        ],
      ]);
      grid.options = this.expandableOptions();
      return;
    }

    if (mode === 'templated') {
      this.replaceTemplates(grid, [
        ['cell-status', '<span class="status-pill status-pill-{{valueLower}}">{{value}}</span>'],
      ]);
      grid.options = this.templatedOptions();
      return;
    }

    this.replaceTemplates(grid, []);
    grid.options = mode === 'tree' ? this.treeOptions() : this.pinningOptions();
  }

  private tradingGridOptions(): GridOptions {
    return {
      id: 'web-components-demo-trading',
      title: 'Web Components Demo: Trading Terminal',
      emptyMessage: 'No data',
      rowIdentity: (row) => String(row['id']),
      data: this.tradingRows,
      rowHeight: 40,
      viewportHeight: 460,
      enableSorting: true,
      enableFiltering: false,
      enableGrouping: false,
      enableColumnMoving: false,
      enableVirtualization: true,
      virtualizationThreshold: 1,
      columnDefs: tradingColumnDefs(),
    };
  }

  private replaceTemplates(
    grid: WebComponentGridElement,
    templates: ReadonlyArray<readonly [slotName: string, markup: string]>,
  ): void {
    grid
      .querySelectorAll<HTMLTemplateElement>('template[slot]')
      .forEach((template) => template.remove());

    for (const [slotName, markup] of templates) {
      const template = document.createElement('template');
      template.slot = slotName;
      template.innerHTML = markup;
      grid.append(template);
    }
  }

  private baseOptions(data: readonly GridRecord[]): GridOptions {
    return {
      id: `web-components-demo-${this.mode()}`,
      title: `Web Components Demo: ${this.mode().charAt(0).toUpperCase()}${this.mode().slice(1)}`,
      emptyMessage: 'No rows match the current filters.',
      rowIdentity: (row) => String(row['id']),
      data,
      rowHeight: 46,
      viewportHeight: 300,
      enableSorting: true,
      enableFiltering: true,
      enableGrouping: false,
      enableColumnMoving: false,
      enableVirtualization: true,
      virtualizationThreshold: 1,
      columnDefs: [
        { name: 'name', displayName: 'Customer', width: 'minmax(13rem, 1.1fr)' },
        { name: 'status', width: 'minmax(9rem, 0.7fr)' },
        {
          name: 'revenue',
          align: 'end',
          width: 'minmax(9rem, 0.7fr)',
          filter: { condition: FILTER_CONDITIONS.greaterThan },
          formatter: (value) => `$${value}`,
        },
        {
          name: 'owner',
          field: 'account.owner',
          displayName: 'Owner',
          width: 'minmax(10rem, 0.8fr)',
        },
      ],
    };
  }

  private primaryOptions(): GridOptions {
    return {
      id: 'ui-grid-web-components-primary',
      title: 'UI Grid Modernized (Web Component)',
      emptyMessage: 'No rows match the current filters.',
      data: this.primaryData,
      rowHeight: 48,
      viewportHeight: 620,
      enableSorting: true,
      enableFiltering: true,
      enableGrouping: true,
      enableColumnMoving: true,
      enableVirtualization: true,
      enableCellEditOnFocus: true,
      virtualizationThreshold: 25,
      benchmark: {
        iterations: 40,
      },
      onRegisterApi: (api) => {
        this.primaryGridApi = api as UiGridApi;
        this.visibleRowCount.set(this.primaryGridApi.core.getVisibleRows().length);
        this.disposePrimaryVisibleRows?.();
        this.disposePrimaryBenchmark?.();
        this.disposePrimaryVisibleRows = this.primaryGridApi.core.on.rowsVisibleChanged((rows) => {
          this.visibleRowCount.set(rows.length);
        });
        this.disposePrimaryBenchmark = this.primaryGridApi.core.on.benchmarkComplete((result) => {
          this.benchmarkResult.set(result as GridBenchmarkResult);
        });
      },
      grouping: {
        groupBy: ['status'],
      },
      rowIdentity: (row) => String(row['id']),
      columnDefs: [
        {
          name: 'name',
          displayName: 'Customer',
          width: 'minmax(14rem, 1.2fr)',
          enableCellEdit: true,
        },
        {
          name: 'company',
          width: 'minmax(12rem, 1fr)',
          enableCellEdit: true,
        },
        {
          name: 'revenue',
          type: 'number',
          align: 'end',
          width: 'minmax(10rem, 0.7fr)',
          filter: { condition: FILTER_CONDITIONS.greaterThan },
          formatter: (value) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(Number(value ?? 0)),
        },
        {
          name: 'status',
          width: 'minmax(8rem, 0.7fr)',
          filter: { condition: FILTER_CONDITIONS.exact },
        },
        {
          name: 'renewalDate',
          type: 'date',
          displayName: 'Renewal',
          width: 'minmax(11rem, 0.8fr)',
          formatter: (value) => new Date(String(value)).toLocaleDateString('en-US'),
        },
        {
          name: 'owner',
          field: 'account.owner',
          displayName: 'Account Owner',
          width: 'minmax(11rem, 0.8fr)',
          enableCellEdit: true,
        },
      ],
    };
  }

  private expandableOptions(): GridOptions {
    return {
      ...this.baseOptions(createHarnessRows()),
      enableExpandable: true,
      expandableRowHeight: 112,
    };
  }

  private treeOptions(): GridOptions {
    return {
      ...this.baseOptions(createTreeRows()),
      enableTreeView: true,
      treeChildrenField: 'children',
      showTreeExpandNoChildren: false,
      treeIndent: 16,
    };
  }

  private templatedOptions(): GridOptions {
    return {
      ...this.baseOptions(createHarnessRows()),
      columnDefs: [
        { name: 'name', displayName: 'Customer', width: 'minmax(13rem, 1.1fr)' },
        {
          name: 'status',
          width: 'minmax(9rem, 0.7fr)',
          filter: { condition: FILTER_CONDITIONS.exact },
        },
        {
          name: 'revenue',
          align: 'end',
          width: 'minmax(9rem, 0.7fr)',
          filter: { condition: FILTER_CONDITIONS.greaterThan },
          formatter: (value) => `$${value}`,
        },
        {
          name: 'owner',
          field: 'account.owner',
          displayName: 'Owner',
          width: 'minmax(10rem, 0.8fr)',
        },
      ],
    };
  }

  private pinningOptions(): GridOptions {
    const data = Array.from({ length: 20 }, (_value, index) => ({
      id: `pin-${index + 1}`,
      name: `Row ${index + 1}`,
      department: index % 3 === 0 ? 'Engineering' : index % 3 === 1 ? 'Design' : 'Sales',
      region:
        index % 4 === 0 ? 'West' : index % 4 === 1 ? 'East' : index % 4 === 2 ? 'Central' : 'South',
      q1: 1000 + index * 120,
      q2: 1100 + index * 95,
      q3: 900 + index * 140,
      q4: 1300 + index * 80,
      total: 4300 + index * 435,
      growth: `${(2.5 + index * 0.3).toFixed(1)}%`,
      status: index % 2 === 0 ? 'Active' : 'Review',
    }));

    return {
      id: 'web-components-demo-pinning',
      title: 'Web Components Demo: Pinning',
      emptyMessage: 'No rows',
      rowIdentity: (row) => String(row['id']),
      data,
      rowHeight: 46,
      viewportHeight: 300,
      enableSorting: true,
      enableFiltering: true,
      enablePinning: true,
      enableVirtualization: true,
      virtualizationThreshold: 1,
      columnDefs: [
        { name: 'name', displayName: 'Name', width: '160px', pinnedLeft: true },
        { name: 'department', displayName: 'Department', width: '180px' },
        { name: 'region', displayName: 'Region', width: '140px' },
        { name: 'q1', displayName: 'Q1 Revenue', width: '180px', align: 'end' },
        { name: 'q2', displayName: 'Q2 Revenue', width: '180px', align: 'end' },
        { name: 'q3', displayName: 'Q3 Revenue', width: '180px', align: 'end' },
        { name: 'q4', displayName: 'Q4 Revenue', width: '180px', align: 'end' },
        { name: 'total', displayName: 'Total', width: '150px', align: 'end' },
        { name: 'growth', displayName: 'Growth', width: '140px', align: 'end' },
        { name: 'status', displayName: 'Status', width: '150px' },
      ],
    };
  }
}
