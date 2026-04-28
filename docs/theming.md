# Theming

UI Grid uses Shadow DOM encapsulation. All visual customization flows through CSS custom properties and `::part()` selectors.

## How It Works

The grid component renders inside a Shadow DOM boundary. Parent styles cannot leak in. Instead, the grid exposes two theming surfaces:

1. **CSS custom properties** — set `--ui-grid-*` variables on any ancestor element. They pierce the shadow boundary.
2. **`::part()` selectors** — target specific structural elements by their part name for full CSS access.

## CSS Custom Properties

| Variable | Default | Controls |
|----------|---------|----------|
| `--ui-grid-surface` | `#ffffff` | Grid background |
| `--ui-grid-border-color` | `#e5e7eb` | All borders |
| `--ui-grid-header-background` | `#f3f4f6` | Header row background |
| `--ui-grid-header-weight` | `600` | Header font weight |
| `--ui-grid-cell-color` | `#111827` | Cell text color |
| `--ui-grid-muted-color` | `#6b7280` | Secondary text (toolbar, empty state) |
| `--ui-grid-row-odd` | `#ffffff` | Odd row background |
| `--ui-grid-row-even` | `#f9fafb` | Even row background (striping) |
| `--ui-grid-row-hover` | `#eff6ff` | Hovered row background |
| `--ui-grid-accent` | `#2563eb` | Active sort/filter indicators, focus rings |
| `--ui-grid-group-background` | `#e5e7eb` | Group header row background |
| `--ui-grid-radius` | `12px` | Container border radius |
| `--ui-grid-shadow` | `0 1px 3px ...` | Container box shadow |

## `::part()` Hooks

| Part Name | Target Element |
|-----------|----------------|
| `shell` | Outermost grid wrapper |
| `hero` | Title/toolbar area |
| `grid-frame` | Scrollable grid container |
| `grid-toolbar` | Toolbar with row count |
| `header` | Header row container |
| `header-cell` | Individual header cell |
| `filter-cell` | Filter input cell |
| `body-cell` | Data cell |
| `group-row` | Group header row |
| `expandable-row` | Expanded detail row |
| `pagination` | Pagination footer |
| `empty-state` | Empty state message |

## Example: Custom Brand Theme

```scss
.my-app {
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

/* Target specific parts for full CSS access */
.my-app app-ui-grid::part(header) {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

## Host Attribute Pattern

The demo app uses `data-color-mode` and `data-visual-mode` attributes on the root component to drive a 2×2 theme matrix (dark/light × studio/wireframe). Each combination defines a full set of semantic CSS tokens that cascade into the grid:

```scss
:host([data-color-mode='dark'][data-visual-mode='default']) {
  --grid-surface: #0b1824;
  --grid-header: #112434;
  --grid-text: #ebf5f9;
  --grid-accent: #67e8f9;
  /* ...then map to --ui-grid-* on the grid container */
}
```

You can use this same pattern in your own app to support multiple themes without JavaScript logic — just set a data attribute and let CSS do the work.
