import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FILTER_CONDITIONS,
  GridCellTemplateContext,
  GridExpandableTemplateContext,
  GridOptions,
  GridRecord,
  GridSavedState,
  UiGridApi,
} from '@ornery/ui-grid';
import { mountUiGrid } from '@ornery/ui-grid-react';
import { CodeBlockComponent } from '../../shared/code-block.component';
import { createDemoData } from '../../shared/demo-data';

type ReactRoot = ReturnType<typeof mountUiGrid>;

type DemoMode = 'expandable' | 'tree' | 'templated' | 'pinning';

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
  selector: 'app-docs-react',
  imports: [RouterLink, CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="react-page-shell">
      <header class="page-hero">
        <div class="page-copy">
          <p class="eyebrow">Root Demo App</p>
          <h1>React Wrapper</h1>
          <p class="page-summary">
            React demo now includes the same 100K-row primary surface as Angular, plus the aligned
            harness scenarios for expanded, tree, templated, and pinning behavior.
          </p>
          <p class="page-links">
            <a routerLink="/home" class="demo-link">Angular Demo</a>
            <a routerLink="/web-components" class="demo-link demo-link-secondary">Web Components</a>
            <a routerLink="/rust" class="demo-link demo-link-secondary">Rust</a>
            <a routerLink="/docs" class="demo-link demo-link-secondary">Docs</a>
          </p>
        </div>
        <div class="page-actions">
          <button type="button" class="demo-button" (click)="captureState()">Capture State</button>
          <button type="button" class="demo-button demo-button-secondary" (click)="restoreState()">
            Restore State
          </button>
          <button type="button" class="demo-button demo-button-secondary" (click)="resetDemo()">
            Reset Demo
          </button>
        </div>
      </header>

      <section class="demo-panel">
        <header class="panel-header">
          <div>
            <h2>100K Rows Demo</h2>
            <p>
              Same primary dataset and options as Angular home: sorting, filtering, grouping, column
              moving, virtualization, and inline editing.
            </p>
          </div>
        </header>
        <div class="react-demo-frame">
          <div #primaryReactDemoHost class="react-demo-host react-demo-host-primary"></div>
        </div>
      </section>

      <section class="demo-panel state-panel">
        <div>
          <h2>Saved State</h2>
          <p>
            Use the shared API: <code>gridApi.saveState.save()</code> and
            <code>gridApi.saveState.restore(...)</code>.
          </p>
        </div>
        <pre>{{ savedStateJson() }}</pre>
      </section>

      <section class="demo-panel usage-panel">
        <header class="panel-header">
          <div>
            <h2>React Demo Code</h2>
            <p>These snippets match the live React wrapper demos on this page: the 100K primary grid and the pinning harness.</p>
          </div>
        </header>
        <div class="code-grid">
          <app-code-block lang="tsx" [code]="reactPrimarySnippet" />
          <app-code-block lang="tsx" [code]="reactPinningSnippet" />
        </div>
      </section>

      <section class="demo-panel">
        <header class="panel-header">
          <div>
            <h2>Scenario Harness</h2>
            <p>Same four scenarios as Angular: expandable, tree, templated, and pinning.</p>
          </div>
        </header>
        <div class="scenario-switch" role="tablist" aria-label="React demo scenarios">
          @for (scenario of scenarios; track scenario.value) {
            <button
              type="button"
              class="scenario-button"
              [class.scenario-button-active]="mode() === scenario.value"
              [attr.aria-selected]="mode() === scenario.value"
              (click)="setMode(scenario.value)"
            >
              {{ scenario.label }}
            </button>
          }
        </div>
        <div class="react-demo-frame">
          <div #reactDemoHost class="react-demo-host"></div>
        </div>
        @if (demoError(); as error) {
          <p class="react-demo-error">{{ error }}</p>
        }
      </section>
    </main>
  `,
  styles: `
    .react-page-shell {
      min-height: 100vh;
      width: min(1380px, calc(100% - 2rem));
      margin: 0 auto;
      padding: clamp(1rem, 2vw, 2rem);
      display: grid;
      gap: 1.25rem;
    }

    .page-hero,
    .demo-panel {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--card-border);
      border-radius: var(--theme-radius);
      background: var(--panel-surface);
      box-shadow: var(--card-shadow);
      backdrop-filter: var(--theme-card-filter);
    }

    .page-hero {
      padding: clamp(1rem, 1.5vw, 1.75rem);
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: end;
      background:
        radial-gradient(
          circle at top right,
          color-mix(in srgb, var(--teal-strong) 18%, transparent),
          transparent 30%
        ),
        linear-gradient(145deg, var(--panel-surface-strong), var(--panel-surface-alt));
    }

    .page-copy {
      display: grid;
      gap: 0.6rem;
      max-width: 60rem;
    }

    .eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.76rem;
      font-weight: 800;
      color: var(--teal-strong);
    }

    .page-copy h1,
    .panel-header h2 {
      margin: 0;
      color: var(--ink-strong);
    }

    .page-summary,
    .panel-header p,
    .state-panel p {
      margin: 0;
      line-height: 1.6;
      color: color-mix(in srgb, var(--ink-strong) 74%, var(--teal-strong) 26%);
    }

    .page-links,
    .page-actions,
    .scenario-switch {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .demo-link,
    .demo-button,
    .scenario-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--theme-switch-radius);
      padding: 0.6rem 1rem;
      font: inherit;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
      transition:
        transform 160ms ease,
        box-shadow 160ms ease;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--teal-strong) 85%, black),
        color-mix(in srgb, var(--teal-strong) 65%, black)
      );
      color: #051017;
      border: 1px solid color-mix(in srgb, var(--teal-strong) 40%, transparent);
      box-shadow: 0 12px 24px rgba(8, 39, 61, 0.18);
    }

    .demo-link:hover,
    .demo-button:hover,
    .scenario-button:hover {
      transform: translateY(-1px);
    }

    .demo-link-secondary,
    .demo-button-secondary,
    .scenario-button-active {
      background: color-mix(in srgb, var(--teal-strong) 14%, var(--panel-surface-strong));
      color: var(--teal-strong);
      border: 1px solid color-mix(in srgb, var(--teal-strong) 25%, transparent);
      box-shadow: none;
    }

    .demo-panel {
      padding: clamp(0.85rem, 1.5vw, 1.25rem);
      display: grid;
      gap: 1rem;
    }

    .panel-header,
    .state-panel {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }

    .state-panel pre {
      margin: 0;
      padding: 1rem;
      border-radius: calc(var(--theme-radius) - 6px);
      border: 1px solid color-mix(in srgb, var(--ink-strong) 14%, transparent);
      background: color-mix(in srgb, var(--panel-surface-strong) 82%, black 18%);
      color: var(--ink-strong);
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .react-demo-frame {
      border: 1px solid color-mix(in srgb, var(--teal-strong) 24%, var(--card-border));
      border-radius: calc(var(--theme-radius) - 6px);
      padding: clamp(0.5rem, 1.2vw, 0.9rem);
      background: color-mix(in srgb, var(--panel-surface-strong) 86%, transparent);
    }

    .react-demo-host {
      min-height: 34rem;
    }

    .react-demo-host-primary {
      min-height: 54rem;
    }

    .react-demo-error {
      margin: 0;
      color: color-mix(in srgb, #dc2626 74%, var(--ink-strong));
      font-weight: 700;
    }

    .code-grid {
      display: grid;
      gap: 1rem;
    }

    @media (max-width: 960px) {
      .react-page-shell {
        width: min(100%, calc(100% - 1rem));
        padding: 0.5rem;
      }

      .page-hero,
      .panel-header,
      .state-panel {
        display: grid;
      }
    }
  `,
})
export class DocsReactComponent {
  @ViewChild('primaryReactDemoHost', { static: true })
  private readonly primaryReactDemoHost?: ElementRef<HTMLElement>;
  @ViewChild('reactDemoHost', { static: true })
  private readonly reactDemoHost?: ElementRef<HTMLElement>;

  private readonly destroyRef = inject(DestroyRef);
  private primaryReactRoot: ReactRoot | null = null;
  private harnessReactRoot: ReactRoot | null = null;
  private primaryGridApi: UiGridApi | null = null;
  private savedGridState: GridSavedState | null = null;

  protected readonly mode = signal<DemoMode>('expandable');
  protected readonly demoError = signal<string | null>(null);
  protected readonly savedStateJson = signal('No saved state captured yet.');
  protected readonly reactPrimarySnippet = `import { UiGrid } from '@ornery/ui-grid-react';
import { FILTER_CONDITIONS, type GridOptions } from '@ornery/ui-grid-core';

const options: GridOptions = {
  id: 'ui-grid-modern-react',
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

export function AccountsGrid() {
  return <UiGrid options={options} className="react-docs-demo-grid" />;
}`;
  protected readonly reactPinningSnippet = `const pinningOptions: GridOptions = {
  id: 'react-demo-pinning',
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
  ];

  constructor() {
    afterNextRender(() => {
      void this.mountPrimaryDemo();
      void this.mountReactDemo();
    });

    this.destroyRef.onDestroy(() => {
      this.primaryReactRoot?.unmount();
      this.harnessReactRoot?.unmount();
      this.primaryReactRoot = null;
      this.harnessReactRoot = null;
      this.primaryGridApi = null;
    });
  }

  protected setMode(mode: DemoMode): void {
    if (this.mode() === mode) {
      return;
    }

    this.mode.set(mode);
    void this.mountReactDemo();
  }

  protected captureState(): void {
    if (!this.primaryGridApi) {
      return;
    }

    this.savedGridState = this.primaryGridApi.saveState.save();
    this.savedStateJson.set(JSON.stringify(this.savedGridState, null, 2));
  }

  protected restoreState(): void {
    if (!this.savedGridState || !this.primaryGridApi) {
      return;
    }

    this.primaryGridApi.saveState.restore(this.savedGridState);
  }

  protected resetDemo(): void {
    this.savedGridState = null;
    this.savedStateJson.set('No saved state captured yet.');
    void this.mountPrimaryDemo();
    void this.mountReactDemo();
  }

  private async mountPrimaryDemo(): Promise<void> {
    const host = this.primaryReactDemoHost?.nativeElement;
    if (!host) {
      return;
    }

    this.primaryReactRoot?.unmount();
    this.primaryReactRoot = null;
    this.primaryGridApi = null;

    try {
      this.primaryReactRoot = mountUiGrid(host, {
        options: this.primaryOptions(),
        className: 'react-docs-demo-grid react-docs-demo-grid-primary',
        onRegisterApi: (api: UiGridApi) => {
          this.primaryGridApi = api;
        },
      });
      this.demoError.set(null);
    } catch (error) {
      this.demoError.set(error instanceof Error ? error.message : String(error));
    }
  }

  private async mountReactDemo(): Promise<void> {
    const host = this.reactDemoHost?.nativeElement;
    if (!host) {
      return;
    }

    this.harnessReactRoot?.unmount();
    this.harnessReactRoot = null;

    try {
      const mode = this.mode();
      const props = {
        options: this.optionsForMode(mode),
        className: 'react-docs-demo-grid',
        cellRenderer: undefined as Parameters<typeof mountUiGrid>[1]['cellRenderer'],
        expandableRenderer: undefined as Parameters<typeof mountUiGrid>[1]['expandableRenderer'],
      };

      if (mode === 'templated') {
        props.cellRenderer = (context: GridCellTemplateContext) => {
          if (context.column.name !== 'status') {
            return null;
          }

          return `Status: ${String(context.value)}`;
        };
      }

      if (mode === 'expandable') {
        const rowRecord = (context: GridExpandableTemplateContext): GridRecord => context.row;
        props.expandableRenderer = (context: GridExpandableTemplateContext) =>
          `Details for ${String(rowRecord(context)['name'])} • Owner: ${String((rowRecord(context)['account'] as Record<string, unknown> | undefined)?.['owner'] ?? 'n/a')}`;
      }

      this.harnessReactRoot = mountUiGrid(host, props);
      this.demoError.set(null);
    } catch (error) {
      this.demoError.set(error instanceof Error ? error.message : String(error));
    }
  }

  private primaryOptions(): GridOptions {
    return {
      id: 'ui-grid-modern-react',
      title: 'UI Grid Modernized (React)',
      emptyMessage: 'No rows match the current filters.',
      rowHeight: 48,
      viewportHeight: 620,
      enableSorting: true,
      enableFiltering: true,
      enableGrouping: true,
      enableColumnMoving: true,
      enableVirtualization: true,
      enableCellEditOnFocus: true,
      virtualizationThreshold: 25,
      grouping: {
        groupBy: ['status'],
      },
      benchmark: {
        iterations: 40,
      },
      rowIdentity: (row) => String(row['id']),
      columnDefs: [
        {
          name: 'name',
          displayName: 'Customer',
          width: 'minmax(14rem, 1.2fr)',
          enableCellEdit: true,
        },
        { name: 'company', width: 'minmax(12rem, 1fr)', enableCellEdit: true },
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
      data: createDemoData(),
    };
  }

  private optionsForMode(mode: DemoMode): GridOptions {
    switch (mode) {
      case 'tree':
        return this.treeOptions();
      case 'templated':
        return this.templatedOptions();
      case 'pinning':
        return this.pinningOptions();
      default:
        return this.expandableOptions();
    }
  }

  private baseOptions(data: readonly GridRecord[]): GridOptions {
    return {
      id: `react-demo-${this.mode()}`,
      title: `React Demo: ${this.mode().charAt(0).toUpperCase()}${this.mode().slice(1)}`,
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
      id: 'react-demo-pinning',
      title: 'React Demo: Pinning',
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
