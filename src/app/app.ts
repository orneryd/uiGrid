import { Component, TemplateRef, computed, signal, viewChild } from '@angular/core';
import { FILTER_CONDITIONS, GridCellTemplateContext, GridOptions, UiGridApi, UiGridComponent } from '@orneryd/uiGrid';
import { GridBrowserHarnessComponent } from './grid-browser-harness.component';

function createDemoData() {
  const statuses = ['Active', 'Expansion', 'Enterprise', 'Pilot'];
  const companies = ['Northwind', 'Blue Harbor', 'Forge Group', 'Larkspur', 'Atlas'];
  const owners = ['Casey Tran', 'Jordan Silva', 'Priya Rao', 'Evan Brooks', 'Mina Patel'];

  return Array.from({ length: 240 }, (_value, index) => ({
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
  styleUrl: './app.scss'
})
export class App {
  private readonly statusTemplate = viewChild<TemplateRef<GridCellTemplateContext>>('statusTemplate');
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
}
