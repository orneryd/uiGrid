import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CodeBlockComponent } from '../../shared/code-block.component';

@Component({
  selector: 'app-docs-web-component',
  imports: [CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="docs-topic">
      <h1>Web Component</h1>
      <p class="docs-lead">
        UI Grid ships as a standard Web Component via Angular Elements.
        Use <code>&lt;ui-grid-element&gt;</code> in any HTML page — no Angular required.
      </p>

      <h2>Build</h2>
      <app-code-block lang="bash" [code]="buildSnippet" />
      <p>This produces <code>dist/ui-grid-element/main.js</code> — a self-contained ES module.</p>

      <h2>Usage</h2>
      <app-code-block lang="html" [code]="usageSnippet" />

      <h2>Setting Options</h2>
      <p>
        The <code>options</code> property accepts the same <code>GridOptions</code> object as the Angular component.
        Set it via JavaScript property assignment — not as an HTML attribute.
      </p>
      <app-code-block lang="javascript" [code]="optionsSnippet" />

      <h2>Styling</h2>
      <p>
        The custom element uses Shadow DOM. Style it the same way as the Angular component —
        via CSS custom properties on an ancestor element:
      </p>
      <app-code-block lang="css" [code]="styleSnippet" />

      <h2>Events</h2>
      <p>
        Use <code>onRegisterApi</code> in the options to receive the grid API, then subscribe to events:
      </p>
      <app-code-block lang="javascript" [code]="eventsSnippet" />

      <h2>CSP Considerations</h2>
      <p>
        The element bundle is a standard ES module. If your CSP blocks inline scripts,
        serve the options setup from an external <code>.js</code> file.
      </p>
    </section>
  `,
  styles: `@use '../docs-topic';`
})
export class DocsWebComponentComponent {
  protected readonly buildSnippet = `npm run build:element`;

  protected readonly usageSnippet = `<!DOCTYPE html>
<html>
<head>
  <script type="module" src="ui-grid-element/main.js"></script>
</head>
<body>
  <ui-grid-element id="my-grid"></ui-grid-element>

  <script type="module">
    const grid = document.querySelector('#my-grid');
    grid.options = {
      id: 'vanilla-grid',
      data: [
        { name: 'Alice', role: 'Engineer', salary: 120000 },
        { name: 'Bob', role: 'Designer', salary: 95000 },
      ],
      columnDefs: [
        { name: 'name' },
        { name: 'role' },
        { name: 'salary', type: 'number', align: 'end' },
      ],
    };
  </script>
</body>
</html>`;

  protected readonly optionsSnippet = `const grid = document.querySelector('ui-grid-element');

// Full GridOptions — same interface as Angular
grid.options = {
  id: 'my-grid',
  data: myData,
  columnDefs: myColumns,
  enableSorting: true,
  enableFiltering: true,
  enableGrouping: true,
  onRegisterApi: (api) => {
    window.gridApi = api;
  },
};`;

  protected readonly styleSnippet = `.my-container {
  --ui-grid-surface: #1a1a2e;
  --ui-grid-cell-color: #e0e0e0;
  --ui-grid-accent: #00d4aa;
  --ui-grid-border-color: rgba(0, 212, 170, 0.2);
  --ui-grid-header-background: #242440;
}`;

  protected readonly eventsSnippet = `grid.options = {
  // ...
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
}
