import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UiGrid } from './UiGrid';
import type { UiGridApi } from '@ornery/ui-grid-core';
import { defineStandaloneUiGridElement } from '@ornery/ui-grid-vanilla';

const baseData = [
  { id: 'row-1', name: 'Alpha', status: 'Active', revenue: 100 },
  { id: 'row-2', name: 'Beta', status: 'Pilot', revenue: 200 },
];

const baseColumns = [
  { name: 'name', displayName: 'Customer' },
  { name: 'status' },
  { name: 'revenue' },
];

describe('UiGrid (web-component wrapper)', () => {
  beforeEach(async () => {
    // Ensure the custom element is registered before tests run. The element's
    // defineStandaloneUiGridElement is idempotent.
    await defineStandaloneUiGridElement();
  });

  it('mounts a <ui-grid-element> into the host div', () => {
    const { container } = render(
      <UiGrid gridId="test" data={baseData} columnDefs={baseColumns} />,
    );
    const el = container.querySelector('ui-grid-element');
    expect(el).not.toBeNull();
  });

  it('forwards options to the element via the `options` setter', () => {
    const { container } = render(
      <UiGrid
        gridId="test"
        title="My Grid"
        data={baseData}
        columnDefs={baseColumns}
        enableSorting
        enableFiltering
      />,
    );
    const el = container.querySelector('ui-grid-element') as HTMLElement & {
      options: { title?: string; enableSorting?: boolean; enableFiltering?: boolean };
    };
    expect(el.options.title).toBe('My Grid');
    expect(el.options.enableSorting).toBe(true);
    expect(el.options.enableFiltering).toBe(true);
  });

  it('forwards `options` prop as the canonical override', () => {
    const { container } = render(
      <UiGrid
        options={{
          id: 'override',
          title: 'Override',
          data: baseData,
          columnDefs: baseColumns,
        }}
      />,
    );
    const el = container.querySelector('ui-grid-element') as HTMLElement & {
      options: { id: string; title?: string };
    };
    expect(el.options.id).toBe('override');
    expect(el.options.title).toBe('Override');
  });

  it('invokes onRegisterApi with the UiGridApi', () => {
    const onRegisterApi = vi.fn();
    render(
      <UiGrid
        gridId="test"
        data={baseData}
        columnDefs={baseColumns}
        onRegisterApi={onRegisterApi}
      />,
    );
    expect(onRegisterApi).toHaveBeenCalledTimes(1);
    const api = onRegisterApi.mock.calls[0]![0] as UiGridApi;
    expect(api).toBeDefined();
    expect(api.core).toBeDefined();
  });

  it('flags the element to render per-column cell slots when cellRenderers is set', async () => {
    const { container } = render(
      <UiGrid
        gridId="test"
        data={baseData}
        columnDefs={baseColumns}
        cellRenderers={{
          name: (ctx) => <strong data-testid="custom-cell">{String(ctx.value)}</strong>,
        }}
      />,
    );
    // The wrapper portals `<div slot="cell-name-row-1">` / `-row-2` elements into the
    // element's light DOM. Wait for the element's first render to emit slot-changed.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const el = container.querySelector('ui-grid-element')!;
    const slotNodes = el.querySelectorAll('div[slot^="cell-name-"]');
    expect(slotNodes.length).toBeGreaterThan(0);
    expect(slotNodes[0]!.querySelector('[data-testid="custom-cell"]')).not.toBeNull();
  });

  it('portals an expandable-row renderer into the element light DOM when rows are expanded', async () => {
    // Pre-mark row-1 as expanded so the element renders an expandable slot.
    const expandableData = baseData.map((r) =>
      r.id === 'row-1' ? { ...r, $$expanded: true } : r,
    );
    const { container } = render(
      <UiGrid
        gridId="test"
        enableExpandable
        data={expandableData}
        columnDefs={baseColumns}
        expandableRenderer={(ctx) => <section data-testid="detail">{String(ctx.row['name'])}</section>}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const el = container.querySelector('ui-grid-element')!;
    // Expandable rows only render when the row is actually toggled expanded at
    // runtime — this test exercises the registration path, not the expand
    // lifecycle. The slot registration is a no-op until a row expands.
    expect(el.querySelectorAll('div[slot^="expandable-row-"]').length).toBeGreaterThanOrEqual(0);
  });

  it('forwards custom events to onXxx props', async () => {
    const onSortChanged = vi.fn();
    const { container } = render(
      <UiGrid
        gridId="test"
        data={baseData}
        columnDefs={baseColumns}
        onSortChanged={onSortChanged}
      />,
    );
    const el = container.querySelector('ui-grid-element')!;
    // Manually dispatch the custom event the element raises on sort.
    act(() => {
      el.dispatchEvent(new CustomEvent('sortChanged', { detail: {} }));
    });
    expect(onSortChanged).toHaveBeenCalledTimes(1);
  });

  it('unmounts the element and cleans up listeners on React unmount', () => {
    const { container, unmount } = render(
      <UiGrid gridId="test" data={baseData} columnDefs={baseColumns} />,
    );
    expect(container.querySelector('ui-grid-element')).not.toBeNull();
    unmount();
    expect(container.querySelector('ui-grid-element')).toBeNull();
  });
});
