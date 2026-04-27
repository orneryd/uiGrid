import { ChangeDetectionStrategy, Component, TemplateRef, computed, signal, viewChild } from '@angular/core';
import { FILTER_CONDITIONS, GridCellTemplateContext, GridOptions, UiGridApi, UiGridComponent } from '@ornery/ui-grid';
import { GridBrowserHarnessComponent } from './grid-browser-harness.component';

interface DemoBadge {
  readonly label: string;
  readonly value: string;
  readonly tone: 'github' | 'framework' | 'package' | 'quality';
}

type ColorMode = 'dark' | 'light';
type VisualMode = 'default' | 'wireframe';

function createDemoData() {
  const statuses = ['Active', 'Expansion', 'Enterprise', 'Pilot'];
  const companies = ['Northwind', 'Blue Harbor', 'Forge Group', 'Larkspur', 'Atlas'];
  const owners = ['Casey Tran', 'Jordan Silva', 'Priya Rao', 'Evan Brooks', 'Mina Patel'];

  return Array.from({ length: 10000 }, (_value, index) => ({
    id: `row-${index + 1}`,
    name: `Customer ${index + 1}`,
    company: companies[index % companies.length],
    revenue: 40000 + index * 1350,
    status: statuses[index % statuses.length],
    renewalDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    account: { owner: owners[index % owners.length] }
  }));
}

@Component({
  selector: 'app-root',
  imports: [UiGridComponent, GridBrowserHarnessComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-color-mode]': 'colorMode()',
    '[attr.data-visual-mode]': 'visualMode()'
  }
})
export class App {
  private readonly statusTemplate = viewChild<TemplateRef<GridCellTemplateContext>>('statusTemplate');
  protected readonly repoUrl = 'https://github.com/orneryd/uiGrid';
  protected readonly colorMode = signal<ColorMode>('dark');
  protected readonly visualMode = signal<VisualMode>('default');
  protected readonly isDarkMode = computed(() => this.colorMode() === 'dark');
  protected readonly isWireframeMode = computed(() => this.visualMode() === 'wireframe');
  protected readonly activeThemeName = computed(() =>
    `${this.isWireframeMode() ? 'Wireframe' : 'Studio'} ${this.isDarkMode() ? 'dark' : 'light'}`
  );
  protected readonly repoBadges: readonly DemoBadge[] = [
    { label: 'GitHub', value: 'orneryd/uiGrid', tone: 'github' },
    { label: 'Angular', value: '21.2', tone: 'framework' },
    { label: 'Package', value: '@ornery/ui-grid', tone: 'package' },
    { label: 'Coverage', value: '90%+', tone: 'quality' }
  ];
  protected readonly featureHighlights = [
    'Signals-powered API surface',
    'Shadow DOM rendering shell',
    'Web component build target',
    'Virtualized 10,000-row showcase'
  ] as const;
  protected readonly gridApi = signal<UiGridApi | null>(null);
  protected readonly options = computed<GridOptions>(() => ({
    id: 'ui-grid-modern',
    title: 'UI Grid Modernized',
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
      groupBy: ['status']
    },
    benchmark: {
      iterations: 40
    },
    rowIdentity: (row) => String(row['id']),
    onRegisterApi: (api) => this.gridApi.set(api as UiGridApi),
    columnDefs: [
      { name: 'name', displayName: 'Customer', width: 'minmax(14rem, 1.2fr)', enableCellEdit: true },
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
            maximumFractionDigits: 0
          }).format(Number(value ?? 0))
      },
      {
        name: 'status',
        width: 'minmax(8rem, 0.7fr)',
        filter: { condition: FILTER_CONDITIONS.exact },
        cellTemplate: this.statusTemplate() ?? undefined
      },
      {
        name: 'renewalDate',
        type: 'date',
        displayName: 'Renewal',
        width: 'minmax(11rem, 0.8fr)',
        formatter: (value) => new Date(String(value)).toLocaleDateString('en-US')
      },
      {
        name: 'owner',
        field: 'account.owner',
        displayName: 'Account Owner',
        width: 'minmax(11rem, 0.8fr)',
        enableCellEdit: true
      }
    ],
    data: createDemoData()
  }));

  protected toggleColorMode(): void {
    this.colorMode.update((mode) => (mode === 'dark' ? 'light' : 'dark'));
  }

  protected toggleVisualMode(): void {
    this.visualMode.update((mode) => (mode === 'default' ? 'wireframe' : 'default'));
  }
}
