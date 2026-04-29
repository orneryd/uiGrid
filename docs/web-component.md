# Web Component

UI Grid ships as a standard Web Component via Angular Elements. Use `<ui-grid-element>` in any HTML page — no Angular required.

For a Rust-first, framework-agnostic bootstrap path, import `defineUiGridRustElement()` from `@ornery/ui-grid` or use the thin `@ornery/ui-grid-vanilla` wrapper package to mount the element with plain DOM APIs.

See [Rust / WASM](./rust.md) for the full local build and run steps for the browser-native Rust-backed demo.

## Build

```bash
npm run build:element
```

This produces `dist/ui-grid-element/main.js` — a self-contained ES module.

## Usage

```html
<!DOCTYPE html>
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
</html>
```

## Setting Options

The `options` property accepts the same `GridOptions` object as the Angular component. Set it via JavaScript property assignment — not as an HTML attribute:

```javascript
const grid = document.querySelector('ui-grid-element');
grid.options = {
  id: 'my-grid',
  data: myData,
  columnDefs: myColumns,
  enableSorting: true,
  enableFiltering: true,
  onRegisterApi: (api) => {
    window.gridApi = api;
  },
};
```

## Styling

The custom element uses Shadow DOM. Style it via CSS custom properties on an ancestor:

```css
.my-container {
  --ui-grid-surface: #1a1a2e;
  --ui-grid-cell-color: #e0e0e0;
  --ui-grid-accent: #00d4aa;
  --ui-grid-border-color: rgba(0, 212, 170, 0.2);
  --ui-grid-header-background: #242440;
}
```

## Events

Use `onRegisterApi` in the options to receive the grid API, then subscribe to events:

```javascript
grid.options = {
  // ...
  onRegisterApi: (api) => {
    api.core.on.sortChanged((column, direction) => {
      console.log('Sort:', column, direction);
    });

    api.edit.on.afterCellEdit((row, col, newVal, oldVal) => {
      console.log('Edited:', col, oldVal, '->', newVal);
    });
  },
};
```
