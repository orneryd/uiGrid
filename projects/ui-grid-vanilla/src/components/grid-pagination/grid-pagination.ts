import template from './grid-pagination.html';

/**
 * `<ui-grid-pagination>` — Pagination controls element.
 *
 * An autonomous custom element that renders pagination navigation: prev/next
 * buttons with SVG icons, page counter, and a page-size select dropdown.
 * Uses shadow DOM with a declarative `.html` template via `@ornery/web-components`.
 *
 * **Rendering pattern:** `template(this).connect()` — instance properties are
 * populated from data attributes, then the HTML template resolves bindings.
 * The `<select>` options and button disabled states are set imperatively after
 * template rendering since they require dynamic DOM manipulation.
 *
 * **Data flow:** The parent serializes all pagination state (range label, page
 * numbers, icon paths, page sizes, disabled states) as data attributes.
 *
 * @example
 * ```html
 * <ui-grid-pagination
 *   data-range-label="1-25 of 100"
 *   data-current-page="1"
 *   data-total-pages="4"
 *   data-page-sizes="[10,25,50,100]"
 *   data-page-size="25"
 *   data-prev-disabled="true"
 *   data-next-disabled="false">
 * </ui-grid-pagination>
 * ```
 */
export class UIGridPagination extends HTMLElement {
  static readonly TAG = 'ui-grid-pagination';

  /** Display string like "1-25 of 100". */
  rangeLabel = '';
  /** Current page number (string for template binding). */
  currentPage = '1';
  /** Total number of pages (string for template binding). */
  totalPages = '1';
  /** Localized "Page" label. */
  pageLabel = '';
  /** Localized "of" conjunction. */
  ofLabel = '';
  /** Localized "Previous" aria-label. */
  prevLabel = '';
  /** Localized "Next" aria-label. */
  nextLabel = '';
  /** Localized "Rows per page" label for the select. */
  rowsLabel = '';
  /** SVG path data for the previous-page icon. */
  prevIconPath = '';
  /** SVG viewBox for the previous-page icon. */
  prevIconViewBox = '0 0 24 24';
  /** SVG path data for the next-page icon. */
  nextIconPath = '';
  /** SVG viewBox for the next-page icon. */
  nextIconViewBox = '0 0 24 24';

  static get observedAttributes(): string[] {
    return ['data-range-label', 'data-current-page', 'data-total-pages',
            'data-page-label', 'data-of-label', 'data-prev-label', 'data-next-label',
            'data-rows-label', 'data-prev-icon-path', 'data-prev-icon-view-box',
            'data-next-icon-path', 'data-next-icon-view-box',
            'data-page-sizes', 'data-page-size', 'data-prev-disabled', 'data-next-disabled'];
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
    // Sync instance properties from data attributes for template binding.
    this.rangeLabel = this.getAttribute('data-range-label') ?? '';
    this.currentPage = this.getAttribute('data-current-page') ?? '1';
    this.totalPages = this.getAttribute('data-total-pages') ?? '1';
    this.pageLabel = this.getAttribute('data-page-label') ?? '';
    this.ofLabel = this.getAttribute('data-of-label') ?? '';
    this.prevLabel = this.getAttribute('data-prev-label') ?? '';
    this.nextLabel = this.getAttribute('data-next-label') ?? '';
    this.rowsLabel = this.getAttribute('data-rows-label') ?? '';
    this.prevIconPath = this.getAttribute('data-prev-icon-path') ?? '';
    this.prevIconViewBox = this.getAttribute('data-prev-icon-view-box') ?? '0 0 24 24';
    this.nextIconPath = this.getAttribute('data-next-icon-path') ?? '';
    this.nextIconViewBox = this.getAttribute('data-next-icon-view-box') ?? '0 0 24 24';

    const pageSizes = JSON.parse(this.getAttribute('data-page-sizes') ?? '[10,25,50,100]') as number[];
    const pageSize = parseInt(this.getAttribute('data-page-size') ?? '25', 10);
    const prevDisabled = this.getAttribute('data-prev-disabled') === 'true';
    const nextDisabled = this.getAttribute('data-next-disabled') === 'true';

    this.className = 'pagination-bar ui-grid-pagination';

    // Render the declarative template into the shadow root.
    template(this).connect();

    // Imperatively set dynamic parts the template can't express.
    const prevBtn = this.querySelector('[data-action="page-prev"]') as HTMLButtonElement | null;
    if (prevBtn && prevDisabled) prevBtn.disabled = true;

    const nextBtn = this.querySelector('[data-action="page-next"]') as HTMLButtonElement | null;
    if (nextBtn && nextDisabled) nextBtn.disabled = true;

    const select = this.querySelector('select[data-role="page-size"]') as HTMLSelectElement | null;
    if (select) {
      select.innerHTML = pageSizes
        .map((size) => `<option value="${size}" ${size === pageSize ? 'selected' : ''}>${size}</option>`)
        .join('');
    }
  }

  static define(tagName = UIGridPagination.TAG): void {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, UIGridPagination);
    }
  }
}
