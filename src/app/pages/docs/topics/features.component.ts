import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GridOptions, UiGridComponent } from '@ornery/ui-grid';
import { createSmallDemoData } from '../../shared/demo-data';

@Component({
  selector: 'app-docs-features',
  imports: [UiGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="docs-topic">
      <h1>Features</h1>
      <p class="docs-lead">
        Every feature is included free and open source. No enterprise tier, no license keys.
        Features can be individually tree-shaken at build time via compile-time feature flags.
      </p>

      <h2>Feature Overview</h2>
      <table class="docs-table">
        <thead><tr><th>Feature</th><th>Option Flag</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>Sorting</td><td><code>enableSorting</code></td><td>true</td><td>Click column headers to cycle asc / desc / none</td></tr>
          <tr><td>Filtering</td><td><code>enableFiltering</code></td><td>true</td><td>Per-column filter inputs with configurable conditions (contains, exact, greaterThan, regex, custom)</td></tr>
          <tr><td>Row Grouping</td><td><code>enableGrouping</code></td><td>false</td><td>Nested multi-column grouping with collapsible group headers</td></tr>
          <tr><td>Tree View</td><td><code>enableTreeView</code></td><td>false</td><td>Hierarchical data with expand/collapse per node</td></tr>
          <tr><td>Expandable Rows</td><td><code>enableExpandable</code></td><td>false</td><td>Master/detail pattern with custom Angular templates</td></tr>
          <tr><td>Cell Editing</td><td><code>enableCellEdit</code></td><td>false</td><td>Inline spreadsheet-style editing with keyboard navigation</td></tr>
          <tr><td>Pagination</td><td><code>enablePagination</code></td><td>false</td><td>Client-side or external pagination with configurable page sizes</td></tr>
          <tr><td>Infinite Scroll</td><td><code>infiniteScrollRowsFromEnd</code></td><td>—</td><td>Bi-directional infinite scroll with loading state</td></tr>
          <tr><td>Column Moving</td><td><code>enableColumnMoving</code></td><td>false</td><td>Drag-and-drop column reordering via CDK</td></tr>
          <tr><td>CSV Export</td><td><code>gridApi.core.exportCsv()</code></td><td>—</td><td>Export visible rows with formula-injection protection</td></tr>
          <tr><td>Virtual Scrolling</td><td><code>enableVirtualization</code></td><td>auto</td><td>CDK virtual scroll viewport, auto-enabled at 40+ rows</td></tr>
          <tr><td>Save / Restore State</td><td><code>gridApi.saveState</code></td><td>—</td><td>Serialize and restore sort, filter, grouping, pagination, and expansion state</td></tr>
          <tr><td>Auto Resize</td><td><code>enableAutoResize</code></td><td>false</td><td>ResizeObserver-driven viewport height recalculation</td></tr>
          <tr><td>Custom Templates</td><td><code>cellTemplate</code></td><td>—</td><td>Angular ng-template for fully custom cell rendering</td></tr>
          <tr><td>Shadow DOM</td><td>always</td><td>—</td><td>Encapsulated styles with CSS custom property and <code>::part()</code> hooks</td></tr>
          <tr><td>Web Component</td><td><code>npm run build:element</code></td><td>—</td><td>Ship as <code>&lt;ui-grid-element&gt;</code> for non-Angular apps</td></tr>
          <tr><td>SSR Support</td><td>automatic</td><td>—</td><td>Server-side rendering with platform-safe guards</td></tr>
          <tr><td>i18n</td><td><code>labels</code></td><td>en-US</td><td>Override any UI string at runtime or bake in a locale at build time</td></tr>
        </tbody>
      </table>

      <h2>Live Example</h2>
      <p>This grid has sorting, filtering, and grouping enabled simultaneously:</p>
      <div class="docs-grid-demo">
        <app-ui-grid [options]="demoOptions" />
      </div>

      <h2>Compile-Time Feature Flags</h2>
      <p>
        When you build a custom bundle with <code>node scripts/build-grid.mjs --features sorting,filtering</code>,
        disabled features are set to <code>false</code> constants. The bundler tree-shakes all guarded code paths,
        producing a smaller output. See <a href="#/docs/custom-builds">Custom Builds</a> for details.
      </p>
    </section>
  `,
  styles: `@use '../docs-topic';`
})
export class DocsFeaturesComponent {
  protected readonly demoOptions: GridOptions = {
    id: 'features-demo',
    data: createSmallDemoData(8),
    viewportHeight: 400,
    rowHeight: 48,
    enableSorting: true,
    enableFiltering: true,
    enableGrouping: true,
    grouping: { groupBy: ['status'] },
    columnDefs: [
      { name: 'name', displayName: 'Customer' },
      { name: 'company' },
      { name: 'status' },
      { name: 'revenue', type: 'number', align: 'end', formatter: (v) => `$${Number(v).toLocaleString()}` }
    ]
  };
}
