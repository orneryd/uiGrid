import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CodeBlockComponent } from '../../shared/code-block.component';

type WebComponentTab = 'angular' | 'vanilla';

@Component({
  selector: 'app-docs-web-component',
  imports: [CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="docs-topic">
      <h1>Web Components</h1>
      <p class="docs-lead">
        UI Grid ships two separate custom-element outputs that share the same default tag name
        <code>&lt;ui-grid-element&gt;</code> but come from different packages with different
        runtime footprints.
      </p>

      <div class="docs-tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          class="docs-tab"
          [class.docs-tab--active]="tab() === 'angular'"
          [attr.aria-selected]="tab() === 'angular'"
          (click)="tab.set('angular')">
          Angular Elements Output
        </button>
        <button
          type="button"
          role="tab"
          class="docs-tab"
          [class.docs-tab--active]="tab() === 'vanilla'"
          [attr.aria-selected]="tab() === 'vanilla'"
          (click)="tab.set('vanilla')">
          Vanilla Output
        </button>
      </div>

      @if (tab() === 'angular') {
        <div role="tabpanel">
          <h2>Angular Elements Output (<code>&#64;ornery/ui-grid</code>)</h2>
          <p>
            The Angular package bundles the grid as a standalone Angular Elements custom element
            via <code>&#64;angular/elements</code>. It carries the Angular runtime and is ideal
            when you are already in an Angular application or want the full Angular rendering
            pipeline exposed as a web component.
          </p>

          <h3>Install</h3>
          <app-code-block lang="bash" [code]="angularInstallSnippet" />

          <h3>Register &amp; Use (declarative)</h3>
          <p>
            All grid options are available as HTML attributes. JSON options use kebab-case
            attribute names; boolean flags are presence-based.
          </p>
          <app-code-block lang="html" [code]="angularDeclarativeSnippet" />

          <h3>Cell templates</h3>
          <p>
            When using the Angular Elements output inside an Angular application, pass a
            <code>TemplateRef&lt;GridCellTemplateContext&gt;</code> to
            <code>column.cellTemplate</code> and a
            <code>TemplateRef&lt;GridExpandableTemplateContext&gt;</code> to
            <code>options.expandableRowTemplate</code>.
          </p>

          <h4>Cell template context — <code>GridCellTemplateContext</code></h4>
          <table class="docs-table">
            <thead><tr><th>Variable binding</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>let-value</code></td><td><code>unknown</code></td><td>Raw cell value (bound via <code>$implicit</code>)</td></tr>
              <tr><td><code>let-row="row"</code></td><td><code>GridRecord</code></td><td>Full row data object</td></tr>
              <tr><td><code>let-column="column"</code></td><td><code>GridColumnDef</code></td><td>Column definition</td></tr>
              <tr><td><code>let-rowIndex="rowIndex"</code></td><td><code>number</code></td><td>0-based visible row index</td></tr>
            </tbody>
          </table>
          <app-code-block lang="html" [code]="angularCellTemplateSnippet" />
          <app-code-block lang="typescript" [code]="angularCellTemplateOptionsSnippet" />

          <h4>Expandable-row context — <code>GridExpandableTemplateContext</code></h4>
          <table class="docs-table">
            <thead><tr><th>Variable binding</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>let-row</code></td><td><code>GridRecord</code></td><td>Full row data object (bound via <code>$implicit</code>)</td></tr>
              <tr><td><code>let-expanded="expanded"</code></td><td><code>boolean</code></td><td>Whether the row is currently expanded</td></tr>
              <tr><td><code>let-rowIndex="rowIndex"</code></td><td><code>number</code></td><td>0-based visible row index</td></tr>
            </tbody>
          </table>
          <app-code-block lang="html" [code]="angularExpandableTemplateSnippet" />

          <h3>Imperative augmentation</h3>
          <p>
            Spread the public <code>options</code> getter to merge in callbacks and advanced
            options without losing the declarative data.
          </p>
          <app-code-block lang="javascript" [code]="angularImperativeSnippet" />

          <h3>Performance guidance</h3>
          <p>
            Declarative attributes are the best authoring experience for initial render and
            occasional reconfiguration, but they are not the cheapest high-frequency update path.
            Updating JSON attributes such as <code>data</code> or <code>column-defs</code>
            requires reparsing the payload and re-running the custom element update flow.
          </p>
          <p>
            Use declarative HTML for first mount, then batch imperative <code>options</code>
            changes from application code. For truly live feeds, prefer the Angular component
            directly instead of the Angular Elements wrapper.
          </p>

          <h3>Declarative surface</h3>
          <p>
            Every attribute maps 1-to-1 to a <code>GridOptions</code> key. JavaScript property
            assignments always win over attribute values.
          </p>
          <app-code-block lang="html" [code]="declarativeSurfaceSnippet" />

          <h3>Events</h3>
          <app-code-block lang="javascript" [code]="eventsSnippet" />

          <h3>Styling</h3>
          <app-code-block lang="css" [code]="styleSnippet" />
        </div>
      }

      @if (tab() === 'vanilla') {
        <div role="tabpanel">
          <h2>Vanilla Output (<code>&#64;ornery/ui-grid-vanilla</code>)</h2>
          <p>
            The vanilla package is a zero-dependency, framework-neutral custom element built with
            plain TypeScript and the same shared pipeline. No Angular, no React — just a standard
            web component that works in any HTML page.
          </p>

          <h3>Install</h3>
          <app-code-block lang="bash" [code]="vanillaInstallSnippet" />

          <h3>Register &amp; Use (declarative)</h3>
          <p>
            The same declarative attribute surface as the Angular Elements output. Drop the element
            into any HTML page and configure it with attributes alone.
          </p>
          <app-code-block lang="html" [code]="vanillaDeclarativeSnippet" />

          <h3>Slot templates</h3>
          <p>
            Customise cell rendering by placing <code>&lt;template&gt;</code> children inside
            the element. Values are injected via <code>{{ '{{token}}' }}</code>
            string interpolation. Dot-path traversal (e.g.&nbsp;<code>row.account.owner</code>)
            works; function calls and operators do not.
          </p>

          <h4>Cell slots — <code>slot="cell-&#123;columnName&#125;"</code></h4>
          <table class="docs-table">
            <thead><tr><th>Token</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>value</code></td><td><code>unknown</code></td><td>Raw cell value as stored in the row data</td></tr>
              <tr><td><code>valueText</code></td><td><code>string</code></td><td>String coercion of <code>value</code> (via <code>String()</code>) — never null or undefined</td></tr>
              <tr><td><code>valueLower</code></td><td><code>string</code></td><td>Lowercase <code>valueText</code> — handy for CSS class suffixes</td></tr>
              <tr><td><code>row</code></td><td><code>object</code></td><td>Full row data record. Dot-path traversal: <code>row.field</code>, <code>row.nested.field</code></td></tr>
              <tr><td><code>column</code></td><td><code>object</code></td><td>The <code>GridColumnDef</code> descriptor for this cell</td></tr>
              <tr><td><code>rowIndex</code></td><td><code>number</code></td><td>0-based visible row index</td></tr>
            </tbody>
          </table>
          <app-code-block lang="html" [code]="vanillaCellSlotSnippet" />

          <h4>Expandable-row slot — <code>slot="expandable-row"</code></h4>
          <table class="docs-table">
            <thead><tr><th>Token</th><th>Type</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>row</code></td><td><code>object</code></td><td>Full row data record</td></tr>
              <tr><td><code>expanded</code></td><td><code>boolean</code></td><td>Whether the row is currently expanded</td></tr>
              <tr><td><code>rowIndex</code></td><td><code>number</code></td><td>0-based visible row index</td></tr>
            </tbody>
          </table>
          <app-code-block lang="html" [code]="vanillaExpandableSlotSnippet" />

          <h3>Imperative augmentation</h3>
          <app-code-block lang="javascript" [code]="vanillaImperativeSnippet" />

          <h3>Performance guidance</h3>
          <p>
            Use declarative attributes for initial mount and infrequent configuration changes.
            Replacing a large JSON <code>data</code> attribute repeatedly is more expensive than
            imperative row updates because the element must parse the new payload, merge options,
            and re-enter its declarative sync path.
          </p>
          <p>
            For streaming datasets, the most efficient sequence is: mount declaratively if you
            want HTML-first setup, then send live row changes through
            <code>grid.setData(rows)</code>. That path is specifically optimized to patch the
            mounted grid instead of treating every tick like a full reconfiguration.
          </p>

          <h3>Live data (trading / high-frequency feeds)</h3>
          <p>
            Use <code>setData(rows)</code> for high-frequency data swaps — it patches cells
            in-place without rebuilding the full shadow DOM.
          </p>
          <app-code-block lang="javascript" [code]="vanillaSetDataSnippet" />

          <h3>Styling</h3>
          <app-code-block lang="css" [code]="styleSnippet" />
        </div>
      }
    </section>
  `,
  styles: `
    @use '../docs-topic';

    .docs-tab-bar {
      display: flex;
      gap: 0.25rem;
      border-bottom: 1px solid var(--ui-grid-border-color, rgba(255,255,255,0.1));
      margin-block: 1.5rem 0;
    }

    .docs-tab {
      padding: 0.5rem 1rem;
      border: none;
      background: none;
      color: var(--ui-grid-cell-color, inherit);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      font-size: 0.9rem;
      opacity: 0.65;
      transition: opacity 0.15s, border-color 0.15s;

      &:hover { opacity: 0.9; }

      &--active {
        opacity: 1;
        border-bottom-color: var(--ui-grid-accent, #00d4aa);
        font-weight: 600;
      }
    }
  `,
})
export class DocsWebComponentComponent {
  protected readonly tab = signal<WebComponentTab>('angular');

  // ── Angular Elements snippets ──────────────────────────────────────────
  protected readonly angularInstallSnippet = `npm install @ornery/ui-grid`;

  protected readonly angularDeclarativeSnippet =
`import { defineUiGridElement } from '@ornery/ui-grid';
await defineUiGridElement();

<!-- HTML -->
<ui-grid-element
  id="my-grid"
  grid-id="accounts-grid"
  title="Accounts"
  row-height="48"
  viewport-height="600"
  column-defs='[{"name":"name"},{"name":"status"},{"name":"revenue","type":"number"}]'
  data='[{"id":"1","name":"Alice","status":"Active","revenue":120000}]'
  enable-sorting
  enable-filtering
  enable-grouping
  enable-virtualization>
</ui-grid-element>`;

  protected readonly angularImperativeSnippet =
`const grid = document.querySelector('#my-grid');

// Spread grid.options to preserve declarative data/columnDefs
grid.options = {
  ...grid.options,
  benchmark: { iterations: 40 },
  onRegisterApi: (api) => {
    api.core.on.rowsVisibleChanged((rows) => console.log(rows.length));
  },
};`;

  protected readonly declarativeSurfaceSnippet =
`<!-- Scalar attributes -->
grid-id="my-id"
title="My Grid"
row-height="48"
viewport-height="600"
virtualization-threshold="25"
empty-message="No rows found."

<!-- JSON attributes -->
column-defs='[{ "name": "status" }]'
data='[{ "id": "1", "status": "Active" }]'
grouping='{ "groupBy": ["status"] }'
pagination-page-sizes='[10, 25, 50]'

<!-- Boolean flags (presence = true) -->
enable-sorting
enable-filtering
enable-grouping
enable-column-moving
enable-pinning
enable-cell-edit
enable-cell-edit-on-focus
enable-pagination
enable-expandable
enable-tree-view
enable-virtualization`;

  protected readonly vanillaCellSlotSnippet =
`<ui-grid-element
  id="orders-grid"
  column-defs='[{"name":"status"},{"name":"amount"}]'
  data='[...]'>

  <!-- cell-{columnName}: renders a custom cell for that column -->
  <template slot="cell-status">
    <span class="pill pill-{{valueLower}}">{{value}}</span>
  </template>

  <!-- Access nested row fields with dot-path notation -->
  <template slot="cell-amount">
    <strong title="{{row.currency}} {{valueText}}">{{valueText}}</strong>
  </template>

</ui-grid-element>`;

  protected readonly vanillaExpandableSlotSnippet =
`<ui-grid-element enable-expandable ...>

  <!-- slot="expandable-row" renders the detail panel below each expanded row -->
  <template slot="expandable-row">
    <article class="detail-card">
      <h3>{{row.name}}</h3>
      <p>Account owner: {{row.account.owner}}</p>
      <p>Row {{rowIndex}} — expanded: {{expanded}}</p>
    </article>
  </template>

</ui-grid-element>`;

  // ── Angular Elements template snippets ────────────────────────────────
  protected readonly angularCellTemplateSnippet =
`<!-- Define the ng-template in your Angular component -->
<ng-template #statusCell
  let-value
  let-row="row"
  let-column="column"
  let-rowIndex="rowIndex">
  <span class="pill" [ngClass]="'pill-' + (value | lowercase)">{{ value }}</span>
</ng-template>`;

  protected readonly angularCellTemplateOptionsSnippet =
`// Wire the TemplateRef into a column definition
import { TemplateRef } from '@angular/core';
import { GridCellTemplateContext } from '@ornery/ui-grid';

@ViewChild('statusCell') statusCellTpl!: TemplateRef<GridCellTemplateContext>;

ngAfterViewInit() {
  this.gridOptions = {
    ...this.gridOptions,
    columnDefs: this.gridOptions.columnDefs.map(col =>
      col.name === 'status' ? { ...col, cellTemplate: this.statusCellTpl } : col
    ),
  };
}`;

  protected readonly angularExpandableTemplateSnippet =
`<!-- $implicit is the row entity, so let-row binds it directly -->
<ng-template #expandableRow
  let-row
  let-expanded="expanded"
  let-rowIndex="rowIndex">
  <article class="detail-card">
    <h3>{{ row['name'] }}</h3>
    <p>{{ row['account']?.['owner'] }}</p>
    <p>Row {{ rowIndex }} — expanded: {{ expanded }}</p>
  </article>
</ng-template>

<!-- Pass to expandableRowTemplate in your options -->`;

  // ── Vanilla snippets ────────────────────────────────────────────────────
  protected readonly vanillaInstallSnippet = `npm install @ornery/ui-grid-vanilla`;

  protected readonly vanillaDeclarativeSnippet =
`import { defineStandaloneUiGridElement } from '@ornery/ui-grid-vanilla';
await defineStandaloneUiGridElement();

<!-- HTML — same attribute surface as the Angular Elements output -->
<ui-grid-element
  id="my-grid"
  grid-id="accounts-grid"
  title="Accounts"
  row-height="48"
  viewport-height="600"
  column-defs='[{"name":"name"},{"name":"status"},{"name":"revenue","type":"number"}]'
  data='[{"id":"1","name":"Alice","status":"Active","revenue":120000}]'
  enable-sorting
  enable-filtering
  enable-virtualization>
</ui-grid-element>`;

  protected readonly vanillaImperativeSnippet =
`const grid = document.querySelector('#my-grid');

// Spread grid.options to preserve attribute-sourced data
grid.options = {
  ...grid.options,
  onRegisterApi: (api) => {
    api.core.on.rowsVisibleChanged((rows) => console.log(rows.length));
  },
};`;

  protected readonly vanillaSetDataSnippet =
`// Fast in-place cell patching — no full re-render
const grid = document.querySelector('#trading-grid');

setInterval(() => {
  rows = tickTradingRows(rows, rng, 6);
  grid.setData(rows);
}, 150);`;

  // ── Shared snippets ─────────────────────────────────────────────────────
  protected readonly eventsSnippet =
`grid.options = {
  ...grid.options,
  onRegisterApi: (api) => {
    api.core.on.sortChanged((column, direction) => {
      console.log('Sort:', column, direction);
    });
    api.core.on.filterChanged((filters) => {
      console.log('Filters:', filters);
    });
    api.edit.on.afterCellEdit((row, col, newVal, oldVal) => {
      console.log('Edited:', col, oldVal, '->', newVal);
    });
  },
};`;

  protected readonly styleSnippet =
`.my-container {
  --ui-grid-surface: #1a1a2e;
  --ui-grid-cell-color: #e0e0e0;
  --ui-grid-accent: #00d4aa;
  --ui-grid-border-color: rgba(0, 212, 170, 0.2);
  --ui-grid-header-background: #242440;
}`;
}
