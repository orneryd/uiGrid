import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import type { GridOptions } from '@ornery/ui-grid';
import { CodeBlockComponent } from '../../shared/code-block.component';
import { createDemoData } from '../../shared/demo-data';

type ReactRuntime = {
  createElement: (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => unknown;
};

type ReactRoot = {
  render: (node: unknown) => void;
  unmount: () => void;
};

type ReactDomClientRuntime = {
  createRoot: (container: Element) => ReactRoot;
};

type ReactGridRuntime = {
  UiGrid: unknown;
};

@Component({
  selector: 'app-docs-react',
  imports: [CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="docs-topic">
      <h1>React</h1>
      <p class="docs-lead">
        <code>&#64;ornery/ui-grid-react</code> is a thin React wrapper that reuses 100% of the
        core TypeScript engine — sorting, filtering, grouping, virtualization, cell editing,
        and the full <code>UiGridApi</code> — with zero code duplication.
      </p>

      <h2>Live Demo</h2>
      <p>
        This page mounts the real React wrapper inside the Angular docs app so you can verify the
        wrapper behavior directly.
      </p>
      <div class="docs-grid-demo react-docs-demo">
        <div #reactDemoHost class="react-demo-host"></div>
      </div>
      @if (demoError(); as error) {
        <p class="react-demo-error">{{ error }}</p>
      }

      <h2>Install</h2>
      <app-code-block lang="bash" [code]="installSnippet" />

      <h2>Minimal Setup</h2>
      <p>Import the <code>UiGrid</code> component and pass a <code>GridOptions</code> object — the same interface used by the Angular component:</p>
      <app-code-block lang="tsx" [code]="minimalSnippet" />

      <h2>Accessing the API</h2>
      <p>
        Use the <code>onRegisterApi</code> callback to receive the <code>UiGridApi</code> object.
        The API is identical to the Angular version — same namespaces, same events, same methods.
      </p>
      <app-code-block lang="tsx" [code]="apiSnippet" />

      <h2>Full Example</h2>
      <p>
        Sorting, filtering, grouping, virtualization, and cell editing — all enabled with the
        same <code>GridOptions</code> you already know:
      </p>
      <app-code-block lang="tsx" [code]="fullSnippet" />

      <h2>Custom Cell Rendering</h2>
      <p>
        Use the <code>cellRenderer</code> prop for custom cell content.
        Return <code>null</code> to fall back to the default display value.
        The <code>GridColumnDef.cellRenderer</code> function (returns a string) also works as-is.
      </p>
      <app-code-block lang="tsx" [code]="cellRendererSnippet" />

      <h2>Expandable Rows</h2>
      <p>
        Use the <code>expandableRenderer</code> prop to render detail content below expanded rows:
      </p>
      <app-code-block lang="tsx" [code]="expandableSnippet" />

      <h2>Hooks</h2>
      <p>The wrapper exports two hooks for advanced use cases:</p>
      <table class="docs-table">
        <thead><tr><th>Hook</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr>
            <td><code>useGridState(options, onRegisterApi?)</code></td>
            <td>
              The core state bridge — maps every Angular signal to React <code>useState</code>.
              Returns the pipeline result, visible columns, labels, and all action dispatchers.
              Used internally by <code>UiGrid</code>; useful if you want to build a fully custom grid shell.
            </td>
          </tr>
          <tr>
            <td><code>useVirtualScroll(options)</code></td>
            <td>
              Lightweight fixed-size row virtualizer. Tracks <code>scrollTop</code>,
              calculates visible range with configurable overscan, returns a viewport ref
              and <code>onScroll</code> handler.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Styling</h2>
      <p>
        Import the grid stylesheet in your app. It uses the same CSS custom properties
        as the Angular version — all <code>--ui-grid-*</code> variables work identically:
      </p>
      <app-code-block lang="tsx" [code]="stylesSnippet" />
      <app-code-block lang="css" [code]="themingSnippet" />

      <h2>Differences from Angular</h2>
      <table class="docs-table">
        <thead><tr><th>Angular</th><th>React</th></tr></thead>
        <tbody>
          <tr>
            <td><code>&lt;app-ui-grid [options]="opts" /&gt;</code></td>
            <td><code>&lt;UiGrid options=&#123;opts&#125; /&gt;</code></td>
          </tr>
          <tr>
            <td><code>cellTemplate</code> (<code>TemplateRef</code>)</td>
            <td><code>cellRenderer</code> prop (render function returning <code>ReactNode</code>)</td>
          </tr>
          <tr>
            <td><code>expandableRowTemplate</code> (<code>TemplateRef</code>)</td>
            <td><code>expandableRenderer</code> prop (render function returning <code>ReactNode</code>)</td>
          </tr>
          <tr>
            <td>Shadow DOM (<code>ViewEncapsulation.ShadowDom</code>)</td>
            <td>Regular DOM with <code>.ui-grid-host</code> class scoping</td>
          </tr>
          <tr>
            <td>CDK drag-and-drop for column moving</td>
            <td>Column reorder via API (<code>gridApi.core.moveColumn</code>)</td>
          </tr>
        </tbody>
      </table>

      <h2>Dev Server</h2>
      <p>Run the React demo app from the monorepo root:</p>
      <app-code-block lang="bash" [code]="devServerSnippet" />

      <h2>Build &amp; Test</h2>
      <app-code-block lang="bash" [code]="buildSnippet" />

      <h2>Public API Exports</h2>
      <app-code-block lang="typescript" [code]="exportsSnippet" />
    </section>
  `,
  styles: `
    @use '../docs-topic';

    .react-docs-demo {
      padding: 1rem;
    }

    .react-demo-host {
      min-height: 54rem;
    }

    .react-demo-error {
      color: #fca5a5;
    }
  `
})
export class DocsReactComponent {
  @ViewChild('reactDemoHost', { static: true })
  private readonly reactDemoHost?: ElementRef<HTMLElement>;

  private readonly destroyRef = inject(DestroyRef);
  protected readonly demoError = signal<string | null>(null);
  private reactRoot: ReactRoot | null = null;
  private readonly demoData = createDemoData().slice(0, 10_000).map((row, index) => ({
    ...row,
    region: ['North America', 'EMEA', 'APAC', 'LATAM'][index % 4],
    tier: ['Strategic', 'Growth', 'Scale'][index % 3],
    seats: 25 + (index % 12) * 15,
  }));
  private readonly demoOptions: GridOptions = {
    id: 'docs-react-demo',
    title: 'React Wrapper Demo',
    emptyMessage: 'No accounts match the current filters.',
    rowHeight: 44,
    viewportHeight: 520,
    enableSorting: true,
    enableFiltering: true,
    enableGrouping: true,
    enablePinning: true,
    enableVirtualization: true,
    virtualizationThreshold: 10,
    enableColumnMoving: true,
    enableCellEditOnFocus: true,
    columnDefs: [
      { name: 'id', displayName: 'ID', width: '11rem', pinnedLeft: true },
      { name: 'name', displayName: 'Customer', width: '16rem', enableCellEdit: true },
      { name: 'company', width: '15rem' },
      { name: 'status', width: '13rem' },
      { name: 'region', width: '13rem' },
      { name: 'tier', displayName: 'Plan Tier', width: '14rem' },
      { name: 'seats', type: 'number', align: 'end', width: '11rem' },
      { name: 'revenue', type: 'number', align: 'end', width: '13rem' },
      { name: 'renewalDate', displayName: 'Renewal', width: '13rem' },
      { name: 'owner', field: 'account.owner', displayName: 'Owner', width: '13rem' },
    ],
    data: this.demoData,
  };

  constructor() {
    afterNextRender(() => {
      void this.mountReactDemo();
    });

    this.destroyRef.onDestroy(() => {
      this.reactRoot?.unmount();
      this.reactRoot = null;
    });
  }

  protected readonly installSnippet = `npm install @ornery/ui-grid-react`;

  protected readonly minimalSnippet = `import { UiGrid } from '@ornery/ui-grid-react';
import type { GridOptions } from '@ornery/ui-grid-react';
import '@ornery/ui-grid-react/styles';

function MyGrid() {
  const options: GridOptions = {
    id: 'my-grid',
    data: [
      { name: 'Alice', role: 'Engineer' },
      { name: 'Bob', role: 'Designer' },
    ],
    columnDefs: [
      { name: 'name' },
      { name: 'role' },
    ],
  };

  return <UiGrid options={options} />;
}`;

  protected readonly apiSnippet = `import { useState } from 'react';
import { UiGrid } from '@ornery/ui-grid-react';
import type { GridOptions, UiGridApi } from '@ornery/ui-grid-react';

function MyGrid() {
  const [gridApi, setGridApi] = useState<UiGridApi | null>(null);

  const options: GridOptions = {
    id: 'api-demo',
    data: myData,
    columnDefs: myColumns,
    onRegisterApi: (api) => setGridApi(api as UiGridApi),
  };

  return (
    <div>
      <button onClick={() => gridApi?.core.sortColumn('name', 'asc')}>
        Sort by Name
      </button>
      <UiGrid options={options} onRegisterApi={options.onRegisterApi} />
    </div>
  );
}`;

  protected readonly fullSnippet = `import { useMemo } from 'react';
import { UiGrid } from '@ornery/ui-grid-react';
import type { GridOptions } from '@ornery/ui-grid-react';
import '@ornery/ui-grid-react/styles';

function Dashboard() {
  const data = useMemo(() => loadAccounts(), []);

  const options = useMemo<GridOptions>(() => ({
    id: 'dashboard-grid',
    title: 'Accounts',
    emptyMessage: 'No accounts match the current filters.',
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
    rowIdentity: (row) => String(row.id),
    columnDefs: [
      { name: 'name', displayName: 'Customer', enableCellEdit: true },
      { name: 'company' },
      {
        name: 'revenue',
        type: 'number',
        align: 'end',
        filter: { condition: 'greaterThan' },
        formatter: (v) => '$' + Number(v).toLocaleString(),
      },
      { name: 'status', filter: { condition: 'exact' } },
      {
        name: 'owner',
        field: 'account.owner',
        displayName: 'Account Owner',
        enableCellEdit: true,
      },
    ],
    data,
  }), [data]);

  return <UiGrid options={options} />;
}`;

  protected readonly cellRendererSnippet = `<UiGrid
  options={options}
  cellRenderer={(ctx) => {
    if (ctx.col.name === 'status') {
      return (
        <span className={\`pill pill-\${ctx.value}\`}>
          {String(ctx.value)}
        </span>
      );
    }
    return null; // default display for other columns
  }}
/>`;

  protected readonly expandableSnippet = `<UiGrid
  options={{
    ...options,
    enableExpandable: true,
    expandableRowHeight: 120,
  }}
  expandableRenderer={(ctx) => (
    <div style={{ padding: '1rem' }}>
      <h4>Details for {String(ctx.row.entity['name'])}</h4>
      <p>Revenue: \${String(ctx.row.entity['revenue'])}</p>
    </div>
  )}
/>`;

  protected readonly stylesSnippet = `// Import the grid CSS in your entry point
import '@ornery/ui-grid-react/styles';`;

  protected readonly themingSnippet = `/* Override CSS custom properties on an ancestor */
.my-container {
  --ui-grid-surface: #1a1a2e;
  --ui-grid-cell-color: #e0e0e0;
  --ui-grid-accent: #00d4aa;
  --ui-grid-border-color: rgba(0, 212, 170, 0.2);
  --ui-grid-header-background: #242440;
}`;

  protected readonly devServerSnippet = `# From the monorepo root
npm run start:react

# Or from the React package directory
cd projects/ui-grid-react
npm start`;

  protected readonly buildSnippet = `# Build ESM, CJS, and declaration files
cd projects/ui-grid-react
npm run build

# Run tests
npm test`;

  protected readonly exportsSnippet = `// Components
export { UiGrid } from '@ornery/ui-grid-react';
export type { UiGridProps } from '@ornery/ui-grid-react';

// Hooks
export { useGridState } from '@ornery/ui-grid-react';
export { useVirtualScroll } from '@ornery/ui-grid-react';

// Re-exported core types (same as @ornery/ui-grid)
export type {
  GridOptions, GridColumnDef, GridRow, GridRecord,
  GridLabels, GridCellTemplateContext, GridExpandableTemplateContext,
  GridBenchmarkResult, GridSavedState, SortState, UiGridApi,
} from '@ornery/ui-grid-react';
export { DEFAULT_GRID_LABELS } from '@ornery/ui-grid-react';`;

  private async mountReactDemo(): Promise<void> {
    const host = this.reactDemoHost?.nativeElement;
    if (!host) {
      return;
    }

    try {
      const [reactModule, reactDomClientModule, reactGridModule] = await Promise.all([
        import('react') as Promise<ReactRuntime>,
        import('react-dom/client') as Promise<ReactDomClientRuntime>,
        import('../../../../../projects/ui-grid-react/dist/index.mjs') as Promise<ReactGridRuntime>,
      ]);

      this.reactRoot = reactDomClientModule.createRoot(host);
      this.reactRoot.render(
        reactModule.createElement(reactGridModule.UiGrid, {
          options: this.demoOptions,
          className: 'react-docs-demo-grid',
        })
      );
      this.demoError.set(null);
    } catch (error) {
      this.demoError.set(error instanceof Error ? error.message : String(error));
    }
  }
}
