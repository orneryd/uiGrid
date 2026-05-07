import template from './grid-group-row.html';

/**
 * `<ui-grid-group-row>` — Group disclosure row element.
 *
 * An autonomous custom element that renders a group header row with a disclosure
 * toggle icon, group field/label, and row count. Uses shadow DOM with a declarative
 * `.html` template via `@ornery/web-components`.
 *
 * **Rendering pattern:** `template(this).connect()` — instance properties are populated
 * from data attributes, then the HTML template resolves `${this.prop}` bindings.
 *
 * **Data flow:** The parent serializes group metadata (field, label, count, depth,
 * icon paths) as data attributes. The component reads them, computes indentation
 * from depth, and renders the disclosure row.
 *
 * @example
 * ```html
 * <ui-grid-group-row
 *   data-action="toggle-group"
 *   data-group="category:Fruit"
 *   data-collapsed="false"
 *   data-field="category"
 *   data-label="Fruit"
 *   data-count="5"
 *   data-depth="0"
 *   data-icon-path="M7 10l5 5 5-5z">
 * </ui-grid-group-row>
 * ```
 */
export class UIGridGroupRow extends HTMLElement {
  static readonly TAG = 'ui-grid-group-row';

  /** The grouping field name (e.g. "category"). */
  field = '';
  /** The group value label (e.g. "Fruit"). */
  label = '';
  /** Number of rows in this group. */
  count = '0';
  /** Accessibility label for the disclosure toggle. */
  disclosureLabel = '';
  /** SVG path data for the disclosure icon. */
  iconPath = '';
  /** SVG viewBox for the disclosure icon. */
  iconViewBox = '0 0 24 24';
  /** Suffix text after the count (e.g. "items"). */
  rowsSuffix = '';

  static get observedAttributes(): string[] {
    return ['data-group', 'data-collapsed', 'data-field', 'data-label',
            'data-count', 'data-depth', 'data-disclosure-label',
            'data-icon-path', 'data-icon-view-box', 'data-rows-suffix'];
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.render();
    }
  }

  private render(): void {
    const depth = parseInt(this.getAttribute('data-depth') ?? '0', 10);
    this.field = this.getAttribute('data-field') ?? '';
    this.label = this.getAttribute('data-label') ?? '';
    this.count = this.getAttribute('data-count') ?? '0';
    this.disclosureLabel = this.getAttribute('data-disclosure-label') ?? '';
    this.iconPath = this.getAttribute('data-icon-path') ?? '';
    this.iconViewBox = this.getAttribute('data-icon-view-box') ?? '0 0 24 24';
    this.rowsSuffix = this.getAttribute('data-rows-suffix') ?? '';

    this.className = 'group-row ui-grid-row ui-grid-group-row';
    this.setAttribute('style', `grid-column: 1 / -1; padding-inline-start:${depth * 20 + 10}px`);

    template(this).connect();
  }

  static define(tagName = UIGridGroupRow.TAG): void {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, UIGridGroupRow);
    }
  }
}
