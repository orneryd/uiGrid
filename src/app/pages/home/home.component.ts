import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FILTER_CONDITIONS,
  GridCellTemplateContext,
  GridOptions,
  GridSavedState,
  UiGridApi,
  UiGridComponent,
} from '@ornery/ui-grid';
import { GridBrowserHarnessComponent } from '../../grid-browser-harness.component';
import { CodeBlockComponent } from '../shared/code-block.component';
import { createDemoData } from '../shared/demo-data';

@Component({
  selector: 'app-page-home',
  imports: [UiGridComponent, GridBrowserHarnessComponent, RouterLink, CodeBlockComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly statusTemplate =
    viewChild<TemplateRef<GridCellTemplateContext>>('statusTemplate');
  private savedGridState: GridSavedState | null = null;
  protected readonly gridApi = signal<UiGridApi | null>(null);
  protected readonly savedStateJson = signal('No saved state captured yet.');
  protected readonly angularDemoSnippet = `import { Component, computed, signal } from '@angular/core';
import {
  FILTER_CONDITIONS,
  type GridOptions,
  type UiGridApi,
  UiGridComponent,
} from '@ornery/ui-grid';

@Component({
  selector: 'app-accounts-grid',
  imports: [UiGridComponent],
  template: '<app-ui-grid [options]="options()" />',
})
export class AccountsGridComponent {
  private readonly gridApi = signal<UiGridApi | null>(null);

  protected readonly options = computed<GridOptions>(() => ({
    id: 'ui-grid-modern',
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
    onRegisterApi: (api) => this.gridApi.set(api as UiGridApi),
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
  }));
}`;
  protected readonly angularStateSnippet = `captureState(): void {
  const api = this.gridApi();
  if (!api) {
    return;
  }

  this.savedGridState = api.saveState.save();
}

restoreState(): void {
  if (!this.savedGridState) {
    return;
  }

  this.gridApi()?.saveState.restore(this.savedGridState);
}`;
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
      groupBy: ['status'],
    },
    benchmark: {
      iterations: 40,
    },
    rowIdentity: (row) => String(row['id']),
    onRegisterApi: (api) => this.gridApi.set(api as UiGridApi),
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
        cellTemplate: this.statusTemplate() ?? undefined,
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
  }));

  protected captureState(): void {
    const api = this.gridApi();
    if (!api) {
      return;
    }

    this.savedGridState = api.saveState.save();
    this.savedStateJson.set(JSON.stringify(this.savedGridState, null, 2));
  }

  protected restoreState(): void {
    if (!this.savedGridState) {
      return;
    }

    this.gridApi()?.saveState.restore(this.savedGridState);
  }
}
