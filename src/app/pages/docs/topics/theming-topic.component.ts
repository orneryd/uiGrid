import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CodeBlockComponent } from '../../shared/code-block.component';

@Component({
  selector: 'app-docs-theming-topic',
  imports: [CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="docs-topic">
      <h1>Theming</h1>
      <p class="docs-lead">
        UI Grid uses Shadow DOM encapsulation. All visual customization flows through
        CSS custom properties and <code>::part()</code> selectors — no style overrides needed.
      </p>

      <h2>How It Works</h2>
      <p>
        The grid component renders inside a Shadow DOM boundary. Parent styles cannot leak in.
        Instead, the grid exposes two theming surfaces:
      </p>
      <ol>
        <li><strong>CSS custom properties</strong> — set <code>--ui-grid-*</code> variables on any ancestor element. They pierce the shadow boundary.</li>
        <li><strong><code>::part()</code> selectors</strong> — target specific structural elements by their part name for full CSS access.</li>
      </ol>

      <h2>CSS Custom Properties</h2>
      <table class="docs-table">
        <thead><tr><th>Variable</th><th>Default</th><th>Controls</th></tr></thead>
        <tbody>
          <tr><td><code>--ui-grid-surface</code></td><td><code>#ffffff</code></td><td>Grid background</td></tr>
          <tr><td><code>--ui-grid-border-color</code></td><td><code>#e5e7eb</code></td><td>All borders</td></tr>
          <tr><td><code>--ui-grid-header-background</code></td><td><code>#f3f4f6</code></td><td>Header row background</td></tr>
          <tr><td><code>--ui-grid-header-weight</code></td><td><code>600</code></td><td>Header font weight</td></tr>
          <tr><td><code>--ui-grid-cell-color</code></td><td><code>#111827</code></td><td>Cell text color</td></tr>
          <tr><td><code>--ui-grid-muted-color</code></td><td><code>#6b7280</code></td><td>Secondary text (toolbar, empty state)</td></tr>
          <tr><td><code>--ui-grid-row-odd</code></td><td><code>#ffffff</code></td><td>Odd row background</td></tr>
          <tr><td><code>--ui-grid-row-even</code></td><td><code>#f9fafb</code></td><td>Even row background (striping)</td></tr>
          <tr><td><code>--ui-grid-row-hover</code></td><td><code>#eff6ff</code></td><td>Hovered row background</td></tr>
          <tr><td><code>--ui-grid-accent</code></td><td><code>#2563eb</code></td><td>Active sort/filter indicators, focus rings</td></tr>
          <tr><td><code>--ui-grid-group-background</code></td><td><code>#e5e7eb</code></td><td>Group header row background</td></tr>
          <tr><td><code>--ui-grid-radius</code></td><td><code>12px</code></td><td>Grid container border radius</td></tr>
          <tr><td><code>--ui-grid-shadow</code></td><td><code>0 1px 3px ...</code></td><td>Grid container box shadow</td></tr>
        </tbody>
      </table>

      <h2>::part() Hooks</h2>
      <table class="docs-table">
        <thead><tr><th>Part Name</th><th>Target Element</th></tr></thead>
        <tbody>
          <tr><td><code>shell</code></td><td>Outermost grid wrapper</td></tr>
          <tr><td><code>hero</code></td><td>Title/toolbar area</td></tr>
          <tr><td><code>grid-frame</code></td><td>Scrollable grid container</td></tr>
          <tr><td><code>grid-toolbar</code></td><td>Toolbar with row count</td></tr>
          <tr><td><code>header</code></td><td>Header row container</td></tr>
          <tr><td><code>header-cell</code></td><td>Individual header cell</td></tr>
          <tr><td><code>filter-cell</code></td><td>Filter input cell</td></tr>
          <tr><td><code>body-cell</code></td><td>Data cell</td></tr>
          <tr><td><code>group-row</code></td><td>Group header row</td></tr>
          <tr><td><code>expandable-row</code></td><td>Expanded detail row</td></tr>
          <tr><td><code>pagination</code></td><td>Pagination footer</td></tr>
          <tr><td><code>empty-state</code></td><td>Empty state message</td></tr>
        </tbody>
      </table>

      <h2>Example: Custom Brand Theme</h2>
      <app-code-block lang="scss" [code]="themeSnippet" />

      <p>
        See the <a href="#/themes">Themes page</a> for a live preview of all four built-in theme modes
        and a copy-pasteable theme SCSS block.
      </p>
    </section>
  `,
  styles: `@use '../docs-topic';`
})
export class DocsThemingTopicComponent {
  protected readonly themeSnippet = `.my-app {
  /* Override grid variables on any ancestor */
  --ui-grid-surface: #1e1b2e;
  --ui-grid-border-color: rgba(139, 92, 246, 0.2);
  --ui-grid-header-background: #2d2640;
  --ui-grid-cell-color: #e2e0f0;
  --ui-grid-muted-color: #8b7fb0;
  --ui-grid-row-odd: #1e1b2e;
  --ui-grid-row-even: #252238;
  --ui-grid-row-hover: #322e4a;
  --ui-grid-accent: #8b5cf6;
  --ui-grid-group-background: #2d2640;
  --ui-grid-radius: 16px;
  --ui-grid-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

/* Or target specific parts */
.my-app app-ui-grid::part(header) {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}`;
}
