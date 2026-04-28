# Accessibility Remediation Plan

**Status:** Draft (reviewed against WAI-ARIA 1.2 + APG grid/tabs patterns)  
**Scope:** `@ornery/ui-grid` library component + browser harness demo  
**Source:** Lighthouse accessibility audit (axe-core 4.11)

---

## Summary of Failures

| axe Rule | Severity | Location | Issue |
|---|---|---|---|
| `aria-allowed-role` | Serious | `ui-grid.component.html:47` | `<section role="grid">` — `<section>` does not allow `role="grid"` |
| `aria-allowed-role` | Serious | `ui-grid.component.html:128` | `<button role="row">` — `<button>` does not allow `role="row"` |
| `aria-required-children` | Critical | `ui-grid.component.html:47–229` | `role="grid"` requires direct `role="row"` children; currently has bare `gridcell`, `input`, and mixed content as direct children |
| `aria-required-parent` | Critical | `ui-grid.component.html:144` | `role="gridcell"` elements lack required `role="row"` parent |
| `aria-conditional-attr` | Serious | `ui-grid.component.html:128` | `aria-expanded` on `role="row"` inside `role="grid"` — only valid inside `role="treegrid"` |
| `aria-allowed-attr` | Serious | `grid-browser-harness.component.ts:70` | `aria-selected` on plain `<button>` — not an allowed ARIA attribute for `button` role |

---

## Fix 1 — Replace `<section role="grid">` with `<div role="grid">`

**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.html:47`

**Problem:** The `<section>` element has an implicit ARIA role of `region`. The WAI-ARIA spec restricts which roles can override it — `grid` is not one of them.

**Fix:** Change the element to a `<div>`, which has no implicit role and freely accepts `role="grid"`.

```html
<!-- BEFORE -->
<section class="grid-frame ui-grid" part="grid-frame" role="grid" ...>

<!-- AFTER -->
<div class="grid-frame ui-grid" part="grid-frame" role="grid" ...>
```

Also change the closing `</section>` to `</div>`.

**Impact:** None — CSS selects on `.grid-frame`, not on `section`.

---

## Fix 2 — Wrap each data row's cells in `<div role="row">`

**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.html:143–172`

**Problem:** Data cells (`role="gridcell"`) are rendered flat inside `role="rowgroup"` without a `role="row"` wrapper. The ARIA grid pattern requires:

```
grid → rowgroup → row → gridcell
```

Currently the structure is:

```
grid → rowgroup → gridcell (INVALID — missing row)
```

**Fix:** Inside `#displayItemTemplate`, wrap the `@for (column of visibleColumns())` loop for regular rows in a `<div role="row">`:

```html
<!-- BEFORE (inside the @else block for regular data rows) -->
@for (column of visibleColumns(); track column.name) {
  <div class="body-cell ui-grid-cell" part="body-cell" role="gridcell" ...>
    ...
  </div>
}

<!-- AFTER -->
<div class="data-row ui-grid-row" role="row"
     [style.display]="'contents'"
     [attr.aria-rowindex]="item.visibleIndex + 2">
  @for (column of visibleColumns(); track column.name) {
    <div class="body-cell ui-grid-cell" part="body-cell" role="gridcell" ...>
      ...
    </div>
  }
</div>
```

**Why `display: contents`:** The grid uses CSS Grid on `.body-grid` with `gridTemplateColumns`. Adding a wrapper `<div>` would break the column layout because each row's cells need to participate in the parent's CSS grid. `display: contents` makes the wrapper "invisible" to CSS grid while keeping it present in the ARIA tree.

**`aria-rowindex`:** Offset by 2 (1-based, plus header row) to give assistive technologies correct position information.

---

## Fix 3 — Wrap expandable rows in `<div role="row">`

**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.html:137–141`

The expandable detail row (`expandable-row`) should also be wrapped in `role="row"` with a single `role="gridcell"` spanning all columns:

```html
<!-- BEFORE -->
<div class="expandable-row ui-grid-row ui-grid-expandable-row" part="expandable-row"
     [style.gridColumn]="'1 / -1'" [style.minHeight.px]="item.row.expandedRowHeight">
  ...
</div>

<!-- AFTER -->
<div class="expandable-row-wrapper" role="row" [style.display]="'contents'">
  <div class="expandable-row ui-grid-row ui-grid-expandable-row" part="expandable-row"
       role="gridcell"
       [attr.aria-colspan]="visibleColumns().length"
       [style.gridColumn]="'1 / -1'" [style.minHeight.px]="item.row.expandedRowHeight">
    ...
  </div>
</div>
```

---

## Fix 4 — Change group row from `<button role="row">` to `<div role="row">` containing a `<button>`

**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.html:128–135`

**Problem:** `<button>` has the implicit role `button`. The WAI-ARIA spec does not allow overriding `button` with `role="row"`. Additionally, `aria-expanded` on a `role="row"` is only valid inside a `role="treegrid"`, not a `role="grid"`.

**Fix:** Use a `<div role="row">` wrapper containing a `<div role="gridcell">` with a `<button>` inside:

```html
<!-- BEFORE -->
<button type="button" class="group-row ..." part="group-row" role="row"
        [attr.aria-expanded]="!item.collapsed" ...
        (click)="toggleGroup(item)">
  <strong>{{ item.field }}: {{ item.label }}</strong>
  <span>{{ item.count }} {{ labels().groupRowsSuffix }}</span>
  <svg ...>...</svg>
  <span class="sr-only">{{ groupDisclosureLabel(item) }}</span>
</button>

<!-- AFTER -->
<div class="group-row-wrapper" role="row" [style.display]="'contents'">
  <div class="group-row ui-grid-row ui-grid-group-row" part="group-row"
       role="gridcell"
       [attr.aria-colspan]="visibleColumns().length"
       [style.gridColumn]="'1 / -1'"
       [style.paddingInlineStart.rem]="item.depth * 1.25 + 1">
    <button type="button" class="group-toggle"
            [attr.aria-expanded]="!item.collapsed"
            [attr.aria-label]="groupDisclosureLabel(item)"
            (click)="toggleGroup(item)">
      <strong>{{ item.field }}: {{ item.label }}</strong>
      <span>{{ item.count }} {{ labels().groupRowsSuffix }}</span>
      <svg class="toggle-icon group-disclosure-icon" viewBox="0 0 24 24"
           aria-hidden="true" focusable="false">
        <path [attr.d]="item.collapsed ? 'M10 7l5 5-5 5z' : 'M7 10l5 5 5-5z'" />
      </svg>
    </button>
  </div>
</div>
```

**Key change:** `aria-expanded` moves from the `role="row"` (invalid in `role="grid"`) to the `<button>` (always valid on buttons). The `<button>` has its native role, no override needed.

---

## Fix 5 — Wrap header row properly

**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.html:60`

The header already has `role="row"`, which is correct. Verify it sits directly under the `role="grid"` element (or a `role="rowgroup"` wrapper). Currently it does — no change needed.

However, the header row is a child of `role="grid"` alongside the body `role="rowgroup"`. For strictest compliance, wrap the header in its own `role="rowgroup"`:

```html
<!-- Optional enhancement for strict compliance -->
<div role="rowgroup">
  <div class="header-grid ..." part="header" role="row" ...>
    ...
  </div>
</div>
```

This is recommended but not strictly required — axe allows `role="row"` as a direct child of `role="grid"`.

---

## Fix 6 — Move filter row into proper grid structure

**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.html:109–124`

**Problem:** The filter row contains `<input>` elements that sit inside the `role="grid"` without a `role="row"` parent. axe flags these as invalid children.

**Fix:** Wrap the filter row in `role="row"` and each filter cell in `role="gridcell"` (not `columnheader` — filter inputs are interactive controls, not headers):

```html
<!-- BEFORE -->
<div class="filter-grid ui-grid-header" part="filters" ...>
  @for (column of visibleColumns(); track column.name) {
    <label class="filter-cell ui-grid-filter-container" part="filter-cell">
      ...
    </label>
  }
</div>

<!-- AFTER -->
<div class="filter-grid ui-grid-header" part="filters" role="row"
     [style.gridTemplateColumns]="gridTemplateColumns()">
  @for (column of visibleColumns(); track column.name) {
    <label class="filter-cell ui-grid-filter-container" part="filter-cell"
           role="gridcell">
      <span class="sr-only ui-grid-sr-only">{{ labels().filterColumn }} {{ headerLabel(column) }}</span>
      <input ... />
    </label>
  }
</div>
```

This places each filter inside a valid `row → gridcell` path within the grid. Using `gridcell` rather than `columnheader` because the actual column headers are in the header row above — these are filter controls, not labels.

---

## Fix 7 — Conditionally use `role="treegrid"` when tree features are active

**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.html:47`  
**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.ts`

**Problem:** `aria-expanded` on `role="row"` elements is only valid inside `role="treegrid"`, not `role="grid"`. Currently the grid always uses `role="grid"`, but tree view and expandable row features use `aria-expanded` on row-level elements.

**Fix:** Dynamically set the role based on whether tree or expandable features are active:

```typescript
// ui-grid.component.ts — add computed signal
protected readonly gridRole = computed(() => {
  if (this.isTreeEnabled() || this.canExpandRows()) {
    return 'treegrid';
  }
  return 'grid';
});
```

```html
<!-- ui-grid.component.html -->
<div class="grid-frame ui-grid" part="grid-frame"
     [attr.role]="gridRole()"
     [attr.aria-label]="options().title ?? 'Data grid'">
```

**Rationale:** `role="treegrid"` is a superset of `role="grid"` — it allows `aria-expanded` on rows, supports hierarchical navigation, and is the correct role when the grid renders parent/child relationships.

---

## Fix 8 — Browser harness: `aria-selected` on mode buttons

**File:** `src/app/grid-browser-harness.component.ts:64–75`

**Problem:** `aria-selected` is not a valid attribute on elements with `role="button"` (the implicit role of `<button>`). The buttons are inside a `role="tablist"`, which is correct, but the buttons need `role="tab"` to make `aria-selected` valid.

**Fix:** Add `role="tab"` to each mode button:

```html
<!-- BEFORE -->
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

<!-- AFTER -->
<div class="browser-harness__modes" role="tablist" aria-label="Browser harness scenarios">
  @for (scenario of scenarios; track scenario.value) {
    <button
      type="button"
      role="tab"
      class="browser-harness__mode"
      [class.browser-harness__mode-active]="mode() === scenario.value"
      [attr.aria-selected]="mode() === scenario.value"
      [tabindex]="mode() === scenario.value ? 0 : -1"
      (click)="setMode(scenario.value)">
      {{ scenario.label }}
    </button>
  }
</div>
```

**Additional:** Add `tabindex` management — the active tab gets `tabindex="0"`, inactive tabs get `tabindex="-1"`. This follows the WAI-ARIA tabs pattern roving tabindex convention.

---

## Fix 9 — Add `aria-rowcount` and `aria-colcount` for virtualized grids

**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.html:47`  
**File:** `projects/ui-grid/src/lib/grid/ui-grid.component.ts`

**Problem:** When virtual scrolling is enabled, only a subset of rows exists in the DOM. Screen readers need `aria-rowcount` on the grid to announce the total size, and `aria-rowindex` on each row to indicate position. Without this, a screen reader user has no way to know the grid's full extent.

**Fix:**

```typescript
// ui-grid.component.ts
protected readonly ariaRowCount = computed(() => {
  // +1 for header row, +1 for filter row if visible
  const headerRows = 1 + (this.isFilteringEnabled() ? 1 : 0);
  return this.pipeline().totalItems + headerRows;
});
```

```html
<div class="grid-frame ui-grid" part="grid-frame"
     [attr.role]="gridRole()"
     [attr.aria-label]="options().title ?? 'Data grid'"
     [attr.aria-rowcount]="ariaRowCount()"
     [attr.aria-colcount]="visibleColumns().length">
```

Also add `aria-colindex` (1-based) to each `gridcell` and `columnheader`:

```html
<div ... role="gridcell" [attr.aria-colindex]="colIdx + 1" ...>
```

**Rationale:** WAI-ARIA 1.2 §5.2.8.8 — when not all rows are present in the DOM (virtualization), authors MUST set `aria-rowcount` on the grid/treegrid and `aria-rowindex` on each row.

---

## Fix 10 — Keyboard arrow navigation for browser harness tabs

**File:** `src/app/grid-browser-harness.component.ts`

**Problem:** The WAI-ARIA tabs pattern requires Left/Right arrow key navigation between tabs. Fix 8 adds `role="tab"` and roving tabindex, but without arrow key handlers, keyboard-only users can't move between tabs using the expected interaction model.

**Fix:** Add a `(keydown)` handler on each tab button:

```typescript
protected handleTabKeyDown(event: KeyboardEvent, index: number): void {
  let nextIndex: number | null = null;
  if (event.key === 'ArrowRight') {
    nextIndex = (index + 1) % this.scenarios.length;
  } else if (event.key === 'ArrowLeft') {
    nextIndex = (index - 1 + this.scenarios.length) % this.scenarios.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = this.scenarios.length - 1;
  }

  if (nextIndex !== null) {
    event.preventDefault();
    this.setMode(this.scenarios[nextIndex].value);
    // Focus the newly active tab button
    const tablist = (event.target as HTMLElement).closest('[role="tablist"]');
    const tabs = tablist?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  }
}
```

```html
<button ... role="tab"
    (keydown)="handleTabKeyDown($event, $index)"
    ...>
```

**Rationale:** WAI-ARIA APG Tabs Pattern — "When focus is on a tab element: Left Arrow moves focus to the previous tab. Right Arrow moves focus to the next tab. Home moves focus to the first tab. End moves focus to the last tab."

---

## Fix 11 — `aria-expanded` placement in treegrid vs grouped rows

**Clarification for implementers:**

- **Tree rows** (Fix 7 — `role="treegrid"`): `aria-expanded` belongs on the `role="row"` element itself. This is correct per WAI-ARIA 1.2 — treegrid rows that can be expanded/collapsed MUST have `aria-expanded`. The current template already places `aria-expanded` on tree row toggles' buttons, but with `role="treegrid"` the canonical location is on the `<div role="row">` wrapping the tree row.

- **Group rows** (Fix 4): `aria-expanded` belongs on the `<button>` inside the gridcell, NOT on the `role="row"`. Group disclosure buttons are interactive controls — `aria-expanded` on a button is always valid regardless of grid vs treegrid.

**Fix for tree rows:** When a data row has tree children, the wrapping `<div role="row">` from Fix 2 should carry `aria-expanded`:

```html
<div class="data-row ui-grid-row" role="row"
     [style.display]="'contents'"
     [attr.aria-rowindex]="item.visibleIndex + 2"
     [attr.aria-expanded]="treeViewFeature && hasTreeChildren(item.row) ? isTreeRowExpanded(item.row) : null">
```

The tree toggle button inside the cell keeps its `aria-label` but no longer needs its own `aria-expanded` since the row carries it.

---

## Files to Modify

| File | Fixes |
|---|---|
| `projects/ui-grid/src/lib/grid/ui-grid.component.html` | #1, #2, #3, #4, #5, #6, #7, #9, #11 |
| `projects/ui-grid/src/lib/grid/ui-grid.component.ts` | #7 (`gridRole`), #9 (`ariaRowCount`), #11 (`hasTreeChildren`) |
| `projects/ui-grid/src/lib/grid/grid.core.styles.scss` | #2, #4 (styles for new wrappers) |
| `projects/ui-grid/src/lib/grid/ui-grid.component.spec.ts` | Update selectors / assertions for all fixes |
| `src/app/grid-browser-harness.component.ts` | #8, #10 |
| `src/app/grid-browser-harness.component.spec.ts` | Update assertions for `role="tab"`, arrow key nav |

---

## CSS Considerations

The `display: contents` strategy for `role="row"` wrappers (Fixes #2, #3, #4) preserves the flat CSS Grid layout. Verify:

1. **No visual regression** — `display: contents` removes the box from the layout, so cells still participate in `.body-grid`'s column template.
2. **Focus management** — `display: contents` elements cannot receive focus themselves, which is correct — focus belongs on the `gridcell` elements.
3. **Browser support** — `display: contents` is supported in all evergreen browsers.
   - **Safari caveat:** Safari versions before 16 stripped `display: contents` elements from the accessibility tree entirely, making ARIA roles on them invisible to VoiceOver. This was fixed in Safari 16 (Sep 2022). Our minimum supported Safari is 16+ so this is safe, but add a regression test that confirms `role="row"` wrappers are exposed to the accessibility tree.
   - **Firefox:** Fully supported since Firefox 62.
   - **Chrome:** Fully supported since Chrome 65.

Add minimal CSS for the new wrapper elements:

```scss
.data-row,
.group-row-wrapper,
.expandable-row-wrapper {
  display: contents;
}
```

### Alternative: CSS `subgrid`

If `display: contents` causes any issues, CSS `subgrid` is an alternative. The row wrapper gets `display: grid; grid-template-columns: subgrid; grid-column: 1 / -1;` which makes it a real box that inherits the parent's column tracks. Subgrid has full support in Chrome 117+, Firefox 71+, Safari 16+. This approach preserves the element's box model (background, border, padding work normally) while still participating in the parent grid. Consider this as a fallback if `display: contents` causes visual or a11y regressions.

---

## Testing Strategy

### Unit Tests
- Verify `role="grid"` or `role="treegrid"` renders based on options
- Verify each data row's cells are inside a `role="row"` parent
- Verify group rows render as `div[role="row"] > div[role="gridcell"] > button`
- Verify filter cells have `role="columnheader"` inside a `role="row"`
- Verify browser harness buttons have `role="tab"` and valid `aria-selected`

### axe-core Integration
- Add `@axe-core/playwright` or `axe-core` to the test suite
- Run axe on the rendered grid in at least these configurations:
  - Basic grid (sorting/filtering)
  - Tree view grid
  - Expandable rows grid
  - Grouped rows grid
- Assert zero violations for `aria-allowed-role`, `aria-required-children`, `aria-required-parent`, `aria-conditional-attr`, `aria-allowed-attr`

### Manual Screen Reader Testing
- VoiceOver (macOS): Navigate the grid with VO+arrow keys, verify row/column announcements
- NVDA (Windows): Verify table navigation mode works correctly with the grid

---

## Execution Order

1. **Fix #1** — Trivial element swap, no dependencies
2. **Fix #8 + #10** — Isolated to browser harness: add `role="tab"`, roving tabindex, arrow key navigation
3. **Fix #7** — Add `gridRole` computed (needed before row wrappers use `aria-expanded`)
4. **Fix #9** — Add `aria-rowcount`, `aria-colcount`, `aria-colindex` (foundational, applies to all row fixes)
5. **Fix #5** — Header `rowgroup` wrapper (recommended for strict compliance)
6. **Fix #6** — Filter row `role="row"` + `role="gridcell"` wrapper
7. **Fix #2 + #11** — Data row wrappers with conditional `aria-expanded` for tree rows
8. **Fix #3** — Expandable row wrappers
9. **Fix #4** — Group row restructure (most complex change)
10. **Run full test suite** — Verify no regressions
11. **Run axe audit** — Confirm all violations resolved
