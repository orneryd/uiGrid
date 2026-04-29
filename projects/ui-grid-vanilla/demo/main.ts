import '@angular/compiler';

import { mountVanillaUiGrid } from '../src/index';
import type { GridOptions } from '../src/index';
import * as uiGridRustWebModule from '../../../dist/ui-grid-wasm-web/ui_grid_wasm.js';

const statuses = ['Active', 'Expansion', 'Enterprise', 'Pilot'] as const;
const companies = ['Northwind', 'Blue Harbor', 'Forge Group', 'Larkspur', 'Atlas'] as const;
const owners = ['Casey Tran', 'Jordan Silva', 'Priya Rao', 'Evan Brooks', 'Mina Patel'] as const;

function createDemoData(count = 5000) {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${i + 1}`,
    name: `Customer ${i + 1}`,
    company: companies[i % companies.length],
    revenue: 40000 + i * 1350,
    status: statuses[i % statuses.length],
    renewalDate: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    account: { owner: owners[i % owners.length] },
  }));
}

const options: GridOptions = {
  id: 'vanilla-demo-grid',
  title: 'UI Grid Vanilla Demo',
  emptyMessage: 'No rows match the current filters.',
  rowHeight: 48,
  viewportHeight: 620,
  enableSorting: true,
  enableFiltering: true,
  enableGrouping: true,
  enableVirtualization: true,
  virtualizationThreshold: 25,
  grouping: { groupBy: ['status'] },
  columnDefs: [
    { name: 'name', displayName: 'Customer', width: 'minmax(14rem, 1.2fr)' },
    { name: 'company', width: 'minmax(12rem, 1fr)' },
    {
      name: 'revenue',
      type: 'number',
      align: 'end',
      width: 'minmax(10rem, 0.7fr)',
    },
    { name: 'status', width: 'minmax(8rem, 0.7fr)' },
    {
      name: 'renewalDate',
      type: 'date',
      displayName: 'Renewal',
      width: 'minmax(11rem, 0.8fr)',
    },
    {
      name: 'owner',
      field: 'account.owner',
      displayName: 'Account Owner',
      width: 'minmax(11rem, 0.8fr)',
    },
  ],
  data: createDemoData(),
};

const mountPoint = document.getElementById('app');

if (!mountPoint) {
  throw new Error('Expected vanilla demo mount point');
}

void mountVanillaUiGrid(mountPoint, options, uiGridRustWebModule).catch((error) => {
  console.error(error);
  mountPoint.textContent = error instanceof Error ? error.message : String(error);
});