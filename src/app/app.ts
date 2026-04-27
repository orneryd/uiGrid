import { Component } from '@angular/core';
import { UiGridComponent } from './grid/ui-grid.component';
import { GridOptions } from './grid/grid.models';
import { FILTER_CONDITIONS } from './grid/grid.constants';

@Component({
  selector: 'app-root',
  imports: [UiGridComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly options: GridOptions = {
    id: 'ui-grid-modern',
    title: 'UI Grid Modernized',
    emptyMessage: 'No rows match the current filters.',
    rowHeight: 48,
    columnDefs: [
      { name: 'name', displayName: 'Customer', width: 'minmax(14rem, 1.2fr)' },
      { name: 'company', width: 'minmax(12rem, 1fr)' },
      {
        name: 'revenue',
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
        filter: { condition: FILTER_CONDITIONS.exact }
      },
      {
        name: 'renewalDate',
        displayName: 'Renewal',
        width: 'minmax(11rem, 0.8fr)',
        formatter: (value) => new Date(String(value)).toLocaleDateString('en-US')
      },
      {
        name: 'owner',
        field: 'account.owner',
        displayName: 'Account Owner',
        width: 'minmax(11rem, 0.8fr)'
      }
    ],
    data: [
      {
        name: 'Northwind Studios',
        company: 'Northwind',
        revenue: 128000,
        status: 'Active',
        renewalDate: '2026-05-14',
        account: { owner: 'Casey Tran' }
      },
      {
        name: 'Blue Harbor Foods',
        company: 'Blue Harbor',
        revenue: 86000,
        status: 'Expansion',
        renewalDate: '2026-06-02',
        account: { owner: 'Jordan Silva' }
      },
      {
        name: 'Signal Forge',
        company: 'Forge Group',
        revenue: 245000,
        status: 'Enterprise',
        renewalDate: '2026-07-20',
        account: { owner: 'Priya Rao' }
      },
      {
        name: 'Larkspur Health',
        company: 'Larkspur',
        revenue: 54000,
        status: 'Pilot',
        renewalDate: '2026-04-30',
        account: { owner: 'Evan Brooks' }
      },
      {
        name: 'Atlas Retail',
        company: 'Atlas',
        revenue: 174000,
        status: 'Active',
        renewalDate: '2026-09-09',
        account: { owner: 'Mina Patel' }
      }
    ]
  };
}
