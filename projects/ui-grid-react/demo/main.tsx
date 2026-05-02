import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { UiGrid } from '../src/index';
import type { GridOptions, UiGridApi } from '../src/index';
import { FILTER_CONDITIONS } from '@ornery/ui-grid-core';
import '../src/ui-grid.css';

const statuses = ['Active', 'Expansion', 'Enterprise', 'Pilot'] as const;
const companies = ['Northwind', 'Blue Harbor', 'Forge Group', 'Larkspur', 'Atlas'] as const;
const owners = ['Casey Tran', 'Jordan Silva', 'Priya Rao', 'Evan Brooks', 'Mina Patel'] as const;

function createDemoData(count = 100_000) {
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

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function App() {
  const [gridApi, setGridApi] = useState<UiGridApi | null>(null);
  const data = useMemo(() => createDemoData(), []);

  const options = useMemo<GridOptions>(
    () => ({
      id: 'react-demo-grid',
      title: 'UI Grid React Demo',
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
      grouping: { groupBy: ['status'] },
      rowIdentity: (row) => String(row['id']),
      onRegisterApi: (api) => setGridApi(api as UiGridApi),
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
          formatter: (value) => currencyFormat.format(Number(value ?? 0)),
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
      data,
    }),
    [data],
  );

  return <UiGrid options={options} onRegisterApi={options.onRegisterApi} />;
}

createRoot(document.getElementById('root')!).render(<App />);
