# Changelog

## v0.1.0 - 2026-04-27

Initial public release of `@ornery/ui-grid`.

### Features

- Angular 21 standalone grid component
- Shadow DOM encapsulation with CSS custom properties and `part` hooks
- Sorting, filtering, grouping, and column moving
- Virtualized rendering with Angular CDK
- Inline cell editing with spreadsheet-style keyboard navigation
- Pagination controls and programmatic pagination API
- Infinite scroll hooks
- Auto-resize hooks
- CSV export
- Benchmark hook
- Transient save/restore state support
- Tree view and expandable-row support
- Web component build output
- Browser demo app for GitHub Pages

### Usage Examples

#### Basic Angular usage

```ts
import { Component } from '@angular/core';
import { UiGridComponent } from '@ornery/ui-grid';

@Component({
  selector: 'app-customers',
  imports: [UiGridComponent],
  template: `<app-ui-grid [options]="gridOptions" />`
})
export class CustomersComponent {
  gridOptions = {
    id: 'customers',
    title: 'Customers',
    data: [
      { id: '1', name: 'Bob', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', status: 'Pilot', revenue: 900 }
    ],
    columnDefs: [
      { name: 'name', displayName: 'Customer' },
      { name: 'status' },
      { name: 'revenue', align: 'end' }
    ],
    enableSorting: true,
    enableFiltering: true,
    enableGrouping: true,
    enableColumnMoving: true
  };
}
```

#### Cell templating

```ts
import { Component, TemplateRef, viewChild } from '@angular/core';
import { GridCellTemplateContext, UiGridComponent } from '@ornery/ui-grid';

@Component({
  selector: 'app-templated-grid',
  imports: [UiGridComponent],
  template: `
    <ng-template #statusTemplate let-value>
      <span class="status-pill">{{ value }}</span>
    </ng-template>

    <app-ui-grid [options]="gridOptions" />
  `
})
export class TemplatedGridComponent {
  private readonly statusTemplate = viewChild.required<TemplateRef<GridCellTemplateContext>>('statusTemplate');

  readonly gridOptions = {
    id: 'templated-customers',
    data: [
      { id: '1', name: 'Bob', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', status: 'Pilot', revenue: 900 }
    ],
    columnDefs: [
      { name: 'name', displayName: 'Customer' },
      { name: 'status', cellTemplate: this.statusTemplate() },
      { name: 'revenue', align: 'end' }
    ]
  };
}
```

#### Expandable-row templating

```ts
import { Component, TemplateRef, viewChild } from '@angular/core';
import { GridExpandableTemplateContext, UiGridComponent } from '@ornery/ui-grid';

@Component({
  selector: 'app-expandable-grid',
  imports: [UiGridComponent],
  template: `
    <ng-template #detailTemplate let-row>
      <div class="detail-card">
        <strong>{{ row.name }}</strong>
        <p>Status: {{ row.status }}</p>
      </div>
    </ng-template>

    <app-ui-grid [options]="gridOptions" />
  `
})
export class ExpandableGridComponent {
  private readonly detailTemplate = viewChild.required<TemplateRef<GridExpandableTemplateContext>>('detailTemplate');

  readonly gridOptions = {
    id: 'expandable-customers',
    data: [
      { id: '1', name: 'Bob', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', status: 'Pilot', revenue: 900 }
    ],
    columnDefs: [
      { name: 'name', displayName: 'Customer' },
      { name: 'status' },
      { name: 'revenue', align: 'end' }
    ],
    enableExpandable: true,
    expandableRowHeight: 120,
    expandableRowTemplate: this.detailTemplate()
  };
}
```

#### Web component usage

```html
<ui-grid-element></ui-grid-element>
<script type="module" src="./dist/ui-grid-element/main.js"></script>
<script>
  const grid = document.querySelector('ui-grid-element');
  grid.options = {
    id: 'customers',
    data: [
      { id: '1', name: 'Bob', status: 'Active', revenue: 1200 },
      { id: '2', name: 'Alice', status: 'Pilot', revenue: 900 }
    ],
    columnDefs: [
      { name: 'name' },
      { name: 'status' },
      { name: 'revenue' }
    ]
  };
</script>
```
