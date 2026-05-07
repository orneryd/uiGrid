import template from './grid-filter-cell.html';

/**
 * `<ui-grid-filter-cell>` — Column filter input element.
 *
 * An autonomous custom element that renders a filter input for a single grid column.
 * Uses shadow DOM with a declarative `.html` template via `@ornery/web-components`.
 *
 * **Rendering pattern:** `template(this).connect()` — the component sets instance
 * properties from data attributes, then the template resolves `${this.prop}` bindings
 * against the component instance. `connect()` auto-detects the open shadowRoot and
 * renders into it.
 *
 * **Data flow:** The parent `<ui-grid-element>` serializes column state into data
 * attributes when generating the filter row HTML. This component reads those attributes,
 * sets class names for pinning state, and renders the filter input.
 *
 * @example
 * ```html
 * <ui-grid-filter-cell
 *   data-column="name"
 *   data-value=""
 *   data-placeholder="Filter name..."
 *   data-disabled="false"
 *   data-pinned="false">
 * </ui-grid-filter-cell>
 * ```
 */
export class UIGridFilterCell extends HTMLElement {
  static readonly TAG = 'ui-grid-filter-cell';

  /** Column name this filter applies to. Bound in template as data-column on the input. */
  columnName = '';
  /** Current filter value. Bound as the input's value attribute. */
  value = '';
  /** Placeholder text shown when filter is empty. */
  placeholder = '';

  static get observedAttributes(): string[] {
    return ['data-column', 'data-value', 'data-placeholder', 'data-disabled',
            'data-pinned', 'data-pinned-left-last', 'data-pinned-right-first',
            'data-sticky-style'];
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
    this.columnName = this.getAttribute('data-column') ?? '';
    this.value = this.getAttribute('data-value') ?? '';
    this.placeholder = this.getAttribute('data-placeholder') ?? '';
    const disabled = this.getAttribute('data-disabled') === 'true';
    const isPinned = this.getAttribute('data-pinned') === 'true';
    const isPinnedLeftLast = this.getAttribute('data-pinned-left-last') === 'true';
    const isPinnedRightFirst = this.getAttribute('data-pinned-right-first') === 'true';
    const stickyStyle = this.getAttribute('data-sticky-style') ?? '';

    this.className = [
      'filter-cell',
      isPinned ? 'is-pinned' : '',
      isPinnedLeftLast ? 'is-pinned-left-last' : '',
      isPinnedRightFirst ? 'is-pinned-right-first' : '',
    ].filter(Boolean).join(' ');

    if (stickyStyle) {
      this.setAttribute('style', stickyStyle);
    }

    template(this).connect();

    const input = this.querySelector('input');
    if (input && disabled) {
      input.disabled = true;
    }
  }

  static define(tagName = UIGridFilterCell.TAG): void {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, UIGridFilterCell);
    }
  }
}
