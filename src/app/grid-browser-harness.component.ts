import { Component, TemplateRef, computed, signal, viewChild } from '@angular/core';
import {
  FILTER_CONDITIONS,
  GridCellTemplateContext,
  GridExpandableTemplateContext,
  GridOptions,
  GridRecord,
  UiGridComponent
} from '@ornery/ui-grid';

type HarnessMode = 'expandable' | 'tree' | 'templated';

function createHarnessRows(count = 18): GridRecord[] {
  return Array.from({ length: count }, (_value, index) => ({
    id: `harness-row-${index + 1}`,
    name: `Harness Row ${index + 1}`,
    status: index % 3 === 0 ? 'Active' : index % 3 === 1 ? 'Pilot' : 'Expansion',
    revenue: 1200 + index * 75,
    renewalDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    account: { owner: `Owner ${index + 1}` }
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
        account: { owner: `Tree Owner ${index + 1}A` }
      },
      {
        id: `parent-${index + 1}-child-2`,
        name: `Child ${index + 1}.2`,
        status: 'Pilot',
        revenue: 900 + index * 60,
        account: { owner: `Tree Owner ${index + 1}B` }
      }
    ]
  }));
}

@Component({
  selector: 'app-grid-browser-harness',
  imports: [UiGridComponent],
  template: `
    <section class="browser-harness">
      <header class="browser-harness__header">
        <div>
          <p class="browser-harness__eyebrow">Browser Harness</p>
          <h2>Virtual scroll branch harness</h2>
          <p>
            Use this in a real browser while running the app to exercise CDK virtual-scroll branches that jsdom does
            not reliably materialize in the unit runner.
          </p>
        </div>
        <div class="browser-harness__modes" role="tablist" aria-label="Browser harness scenarios">
          @for (scenario of scenarios; track scenario.value) {
            <button
              type="button"
              class="browser-harness__mode"
              [class.browser-harness__mode-active]="mode() === scenario.value"
              [attr.aria-selected]="mode() === scenario.value"
              (click)="setMode(scenario.value)">
              {{ scenario.label }}
            </button>
          }
        </div>
      </header>

      <ng-template #status let-value>
        <span class="browser-harness__status">{{ value }}</span>
      </ng-template>

      <ng-template #detail let-row>
        <div class="browser-harness__detail">{{ row.name }} browser detail</div>
      </ng-template>

      <app-ui-grid [options]="options()" />
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 2rem;
      --browser-harness-border: var(--app-browser-harness-border, color-mix(in srgb, currentColor 12%, transparent));
      --browser-harness-panel: var(--app-browser-harness-panel, color-mix(in srgb, currentColor 4%, transparent));
      --browser-harness-button-bg: var(--app-browser-harness-button-bg, var(--ui-grid-surface, white));
      --browser-harness-button-text: var(--app-browser-harness-button-text, currentColor);
      --browser-harness-button-active-bg: var(--app-browser-harness-button-active-bg, var(--ui-grid-accent, #14212d));
      --browser-harness-button-active-text: var(--app-browser-harness-button-active-text, var(--ui-grid-surface, white));
      --browser-harness-status-bg: var(--app-browser-harness-status-bg, var(--ui-grid-status-active-bg, #d7efe5));
      --browser-harness-status-text: var(--app-browser-harness-status-text, var(--ui-grid-status-active-color, #0c4c32));
      --browser-harness-detail-bg: var(--app-browser-harness-detail-bg, color-mix(in srgb, var(--ui-grid-accent, #14212d) 12%, var(--ui-grid-surface, white)));
      --browser-harness-detail-text: var(--app-browser-harness-detail-text, var(--ui-grid-cell-color, currentColor));
    }

    .browser-harness {
      display: grid;
      gap: 1rem;
    }

    .browser-harness__header {
      display: grid;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border: 1px solid var(--browser-harness-border);
      border-radius: 1rem;
      background: linear-gradient(135deg, var(--browser-harness-panel), transparent);
    }

    .browser-harness__eyebrow {
      margin: 0 0 0.35rem;
      font-size: 0.75rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .browser-harness__header h2,
    .browser-harness__header p {
      margin: 0;
    }

    .browser-harness__modes {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .browser-harness__mode {
      border: 1px solid var(--browser-harness-border);
      border-radius: 999px;
      background: var(--browser-harness-button-bg);
      color: var(--browser-harness-button-text);
      padding: 0.55rem 0.9rem;
      cursor: pointer;
      font: inherit;
    }

    .browser-harness__mode-active {
      background: var(--browser-harness-button-active-bg);
      color: var(--browser-harness-button-active-text);
    }

    .browser-harness__status {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.2rem 0.55rem;
      background: var(--browser-harness-status-bg);
      color: var(--browser-harness-status-text);
      font-size: 0.85rem;
      font-weight: 600;
    }

    .browser-harness__detail {
      padding: 0.85rem 1rem;
      border-radius: 0.75rem;
      background: var(--browser-harness-detail-bg);
      color: var(--browser-harness-detail-text);
      font-weight: 600;
    }
  `
})
export class GridBrowserHarnessComponent {
  protected readonly mode = signal<HarnessMode>('expandable');
  protected readonly scenarios = [
    { label: 'Expandable', value: 'expandable' },
    { label: 'Tree', value: 'tree' },
    { label: 'Templated', value: 'templated' }
  ] as const;

  private readonly statusTemplate = viewChild<TemplateRef<GridCellTemplateContext>>('status');
  private readonly detailTemplate = viewChild<TemplateRef<GridExpandableTemplateContext>>('detail');

  protected readonly options = computed<GridOptions>(() => {
    switch (this.mode()) {
      case 'tree':
        return this.treeOptions();
      case 'templated':
        return this.templatedOptions();
      default:
        return this.expandableOptions();
    }
  });

  protected setMode(mode: HarnessMode): void {
    this.mode.set(mode);
  }

  private baseOptions(data: readonly GridRecord[]): GridOptions {
    return {
      id: `browser-harness-${this.mode()}`,
      title: `Browser Harness: ${this.mode().charAt(0).toUpperCase()}${this.mode().slice(1)}`,
      emptyMessage: 'No browser harness rows',
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
          formatter: (value) => `$${value}`
        },
        { name: 'owner', field: 'account.owner', displayName: 'Owner', width: 'minmax(10rem, 0.8fr)' }
      ]
    };
  }

  private expandableOptions(): GridOptions {
    return {
      ...this.baseOptions(createHarnessRows()),
      enableExpandable: true,
      expandableRowHeight: 112,
      expandableRowTemplate: this.detailTemplate() ?? undefined
    };
  }

  private treeOptions(): GridOptions {
    return {
      ...this.baseOptions(createTreeRows()),
      enableTreeView: true,
      treeChildrenField: 'children',
      showTreeExpandNoChildren: false,
      treeIndent: 16
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
          cellTemplate: this.statusTemplate() ?? undefined,
          filter: { condition: FILTER_CONDITIONS.exact }
        },
        {
          name: 'revenue',
          align: 'end',
          width: 'minmax(9rem, 0.7fr)',
          filter: { condition: FILTER_CONDITIONS.greaterThan },
          formatter: (value) => `$${value}`
        },
        { name: 'owner', field: 'account.owner', displayName: 'Owner', width: 'minmax(10rem, 0.8fr)' }
      ]
    };
  }
}