import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UiGrid } from '../src/index';
import type { GridOptions, UiGridApi } from '../src/index';
import { FILTER_CONDITIONS } from '@ornery/ui-grid-core';
import '../src/ui-grid.css';
import './demo.css';

const statuses = ['Active', 'Expansion', 'Enterprise', 'Pilot'] as const;
const companies = ['Northwind', 'Blue Harbor', 'Forge Group', 'Larkspur', 'Atlas'] as const;
const owners = ['Casey Tran', 'Jordan Silva', 'Priya Rao', 'Evan Brooks', 'Mina Patel'] as const;

type Row = {
  id: string;
  name: string;
  company: (typeof companies)[number];
  revenue: number;
  status: (typeof statuses)[number];
  renewalDate: string;
  account: { owner: (typeof owners)[number] };
  notes: string;
};

function createDemoData(count = 100_000): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${i + 1}`,
    name: `Customer ${i + 1}`,
    company: companies[i % companies.length]!,
    revenue: 40000 + i * 1350,
    status: statuses[i % statuses.length]!,
    renewalDate: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    account: { owner: owners[i % owners.length]! },
    notes: `Notes for customer ${i + 1} — account managed by ${owners[i % owners.length]}.`,
  }));
}

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

// ---------------------------------------------------------------------------
// Renderer components — each one is a pure React component so it benefits
// from hooks / context / memoization the same as any other React subtree.
// ---------------------------------------------------------------------------

function StatusBadge({ value }: { value: string }): React.ReactElement {
  const palette: Record<string, { bg: string; color: string }> = {
    Active: { bg: 'rgba(22, 163, 74, 0.2)', color: '#166534' },
    Expansion: { bg: 'rgba(37, 99, 235, 0.2)', color: '#1d4ed8' },
    Enterprise: { bg: 'rgba(15, 118, 110, 0.2)', color: '#115e59' },
    Pilot: { bg: 'rgba(234, 88, 12, 0.2)', color: '#c2410c' },
  };
  const tone = palette[value] ?? { bg: 'rgba(100, 116, 139, 0.2)', color: '#334155' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.15rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.82rem',
        fontWeight: 600,
        background: tone.bg,
        color: tone.color,
      }}
    >
      {value}
    </span>
  );
}

function RevenueCell({ value }: { value: number }): React.ReactElement {
  const high = value >= 80000;
  return (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontWeight: high ? 700 : 500,
        color: high ? '#16a34a' : 'inherit',
      }}
    >
      {currencyFormat.format(value)}
    </span>
  );
}

function HeaderWithIcon({ label, icon }: { label: string; icon: string }): React.ReactElement {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>
        {icon}
      </span>
      <strong style={{ letterSpacing: '0.02em' }}>{label}</strong>
    </span>
  );
}

function ExpandableDetail({ row }: { row: Row }): React.ReactElement {
  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        background: 'rgba(15, 118, 110, 0.08)',
        borderLeft: '4px solid #0f766e',
      }}
    >
      <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem' }}>
        {row.name} · {row.company}
      </h4>
      <p style={{ margin: '0 0 0.35rem', fontSize: '0.88rem', color: '#475569' }}>{row.notes}</p>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '0.25rem 0.75rem',
          margin: 0,
          fontSize: '0.85rem',
        }}
      >
        <dt style={{ fontWeight: 600 }}>Renewal</dt>
        <dd style={{ margin: 0 }}>{new Date(row.renewalDate).toLocaleDateString('en-US')}</dd>
        <dt style={{ fontWeight: 600 }}>Account owner</dt>
        <dd style={{ margin: 0 }}>{row.account.owner}</dd>
        <dt style={{ fontWeight: 600 }}>Revenue</dt>
        <dd style={{ margin: 0 }}>{currencyFormat.format(row.revenue)}</dd>
      </dl>
    </div>
  );
}

function CustomGroupRow({
  label,
  count,
  field,
  collapsed,
}: {
  label: string;
  count: number;
  field: string;
  collapsed: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.6rem 1rem',
        background: 'linear-gradient(90deg, rgba(15, 118, 110, 0.12), transparent)',
        fontWeight: 600,
      }}
    >
      <span style={{ fontSize: '0.78rem', color: '#0f766e', letterSpacing: '0.08em' }}>
        {field.toUpperCase()}
      </span>
      <strong>{label}</strong>
      <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: '#475569' }}>
        {count} rows
      </span>
      <span aria-hidden="true" style={{ fontSize: '1rem' }}>
        {collapsed ? '▶' : '▼'}
      </span>
    </div>
  );
}

function CustomFilter({
  placeholder,
  value,
  disabled,
  onChange,
}: {
  placeholder: string;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        width: '100%',
        padding: '0.3rem 0.55rem',
        background: 'rgba(15, 23, 42, 0.04)',
        borderRadius: 999,
        border: '1px solid rgba(15, 23, 42, 0.1)',
      }}
    >
      <span aria-hidden="true" style={{ opacity: 0.5 }}>
        🔎
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          font: 'inherit',
          color: 'inherit',
        }}
      />
    </div>
  );
}

function EmptyState({
  heading,
  description,
}: {
  heading: string;
  description: string;
}): React.ReactElement {
  return (
    <div
      style={{
        padding: '2rem 1.5rem',
        display: 'grid',
        gap: '0.5rem',
        justifyItems: 'center',
        textAlign: 'center',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '2.5rem' }}>
        🌤️
      </span>
      <strong style={{ fontSize: '1.05rem' }}>{heading}</strong>
      <p style={{ margin: 0, color: '#475569' }}>{description}</p>
      <small style={{ color: '#64748b' }}>
        — rendered by a React component via the emptyRenderer prop
      </small>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App(): React.ReactElement {
  const [gridApi, setGridApi] = useState<UiGridApi | null>(null);
  const [filterOut, setFilterOut] = useState(false);

  const data = useMemo(() => createDemoData(40), []);
  const visibleData = useMemo(
    () => (filterOut ? data.filter(() => false) : data),
    [data, filterOut],
  );

  const columnDefs = useMemo<GridOptions['columnDefs']>(
    () => [
      { name: 'name', displayName: 'Customer', width: 'minmax(12rem, 1.2fr)' },
      { name: 'company', width: 'minmax(11rem, 1fr)' },
      {
        name: 'revenue',
        type: 'number',
        align: 'end',
        width: 'minmax(10rem, 0.8fr)',
        filter: { condition: FILTER_CONDITIONS.greaterThan },
      },
      {
        name: 'status',
        width: 'minmax(9rem, 0.7fr)',
        filter: { condition: FILTER_CONDITIONS.exact },
      },
      {
        name: 'renewalDate',
        type: 'date',
        displayName: 'Renewal',
        width: 'minmax(10rem, 0.8fr)',
      },
      {
        name: 'owner',
        field: 'account.owner',
        displayName: 'Owner',
        width: 'minmax(11rem, 0.9fr)',
      },
    ],
    [],
  );

  return (
    <section className="react-demo-shell">
      <header className="react-demo-shell__header">
        <div>
          <p className="react-demo-shell__eyebrow">React wrapper demo</p>
          <h2>Framework-rendered templates</h2>
          <p>
            Every template slot the grid exposes — <strong>cells</strong>, <strong>headers</strong>,
            <strong> filters</strong>, <strong>group rows</strong>,{' '}
            <strong>expandable detail</strong>, and the <strong>empty state</strong> — is rendered
            by a React component in this demo, projected into the grid's shadow DOM via the
            framework-slot bridge.
          </p>
        </div>

        <div className="react-demo-shell__actions">
          <button
            type="button"
            className="react-demo-shell__button"
            onClick={() => gridApi?.core.benchmark()}
          >
            Benchmark
          </button>
          <button
            type="button"
            className="react-demo-shell__button react-demo-shell__button-secondary"
            onClick={() => setFilterOut((prev) => !prev)}
          >
            {filterOut ? 'Restore rows' : 'Empty the grid'}
          </button>
          <div className="react-demo-shell__stats">
            <span>{visibleData.length}</span>
            <small>rows</small>
          </div>
        </div>
      </header>

      <section className="react-demo-shell__metrics" aria-label="Template coverage">
        <article>
          <strong>6</strong>
          <span>template slot kinds</span>
        </article>
        <article>
          <strong>Portals</strong>
          <span>React into shadow DOM</span>
        </article>
        <article>
          <strong>Zero</strong>
          <span>framework-specific grid code</span>
        </article>
      </section>

      <UiGrid
        gridId="react-wrapper-demo"
        title="React wrapper demo"
        rowHeight={48}
        enableSorting
        enableFiltering
        enableGrouping
        enableExpandable
        enablePinning
        enableColumnMoving
        enableColumnResizing
        enableVirtualization
        virtualizationThreshold={25}
        grouping={{ groupBy: ['status'] }}
        expandableRowHeight={220}
        data={visibleData}
        columnDefs={columnDefs}
        onRegisterApi={(api) => setGridApi(api)}
        cellRenderers={{
          // Per-column JSX renderers: keep the default for most columns,
          // customize `status` (badge) and `revenue` (green/bold for high values).
          status: (ctx) => <StatusBadge value={String(ctx.value ?? '')} />,
          revenue: (ctx) => <RevenueCell value={Number(ctx.value ?? 0)} />,
          name: (ctx) => (
            <a
              href={`#/customer/${ctx.row['id']}`}
              style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 600 }}
            >
              {String(ctx.value ?? '')}
            </a>
          ),
        }}
        headerRenderers={{
          // Custom headers with emoji icons.
          name: (ctx) => <HeaderWithIcon label={ctx.value} icon="🧑" />,
          revenue: (ctx) => <HeaderWithIcon label={ctx.value} icon="💰" />,
          status: (ctx) => <HeaderWithIcon label={ctx.value} icon="🏷️" />,
          renewalDate: (ctx) => <HeaderWithIcon label={ctx.value} icon="📅" />,
        }}
        filterRenderers={{
          // Custom filter chrome — the consumer owns the input. The wrapper
          // passes the current filter value + placeholder + disabled flag in.
          name: (ctx) => (
            <CustomFilter
              placeholder={ctx.placeholder}
              value={ctx.value}
              disabled={ctx.disabled}
              onChange={(next) => gridApi?.core.setFilter(ctx.columnName, next)}
            />
          ),
          company: (ctx) => (
            <CustomFilter
              placeholder={ctx.placeholder}
              value={ctx.value}
              disabled={ctx.disabled}
              onChange={(next) => gridApi?.core.setFilter(ctx.columnName, next)}
            />
          ),
        }}
        groupRowRenderer={(ctx) => (
          <CustomGroupRow
            label={ctx.label}
            count={ctx.count}
            field={ctx.field}
            collapsed={ctx.collapsed}
          />
        )}
        expandableRenderer={(ctx) => <ExpandableDetail row={ctx.row as Row} />}
        emptyRenderer={(ctx) => <EmptyState heading={ctx.heading} description={ctx.description} />}
      />
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
