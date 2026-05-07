/**
 * `<ui-grid-body-cell>` — Data cell element.
 *
 * An autonomous custom element that manages CSS class state for a single grid
 * data cell. Does NOT use shadow DOM or an HTML template.
 *
 * **Performance strategy:** This is the hottest render path in the grid — there
 * can be thousands of body cells on screen. To avoid DOM construction overhead,
 * the parent `<ui-grid-element>` pre-renders the full innerHTML (cell-shell,
 * tree/expand toggles, cell-content) as a string. This component only computes
 * CSS classes from data attributes on upgrade via `attributeChangedCallback`.
 *
 * **Why no template:** Calling `template(this).connect()` on every cell would
 * create DOM nodes via DOMParser for each cell on every render. Instead, the
 * parent sets innerHTML in bulk (one string concatenation), and the browser
 * parser creates all cells at once. The component class just manages state.
 *
 * @example
 * ```html
 * <ui-grid-body-cell
 *   data-row="row-1"
 *   data-column="name"
 *   data-odd="true"
 *   data-pinned="false">
 *   <div class="cell-shell">
 *     <div class="cell-content">Alice</div>
 *   </div>
 * </ui-grid-body-cell>
 * ```
 */
export class UIGridBodyCell extends HTMLElement {
  static readonly TAG = 'ui-grid-body-cell';

  static get observedAttributes(): string[] {
    return ['data-odd', 'data-align', 'data-pinned', 'data-pinned-left-last',
            'data-pinned-right-first', 'data-focused', 'data-editing',
            'data-sticky-style'];
  }

  connectedCallback(): void {
    this.applyState();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.applyState();
    }
  }

  /** Compute CSS classes from data attributes. Called on connect and attribute change. */
  private applyState(): void {
    const isOdd = this.getAttribute('data-odd') === 'true';
    const align = this.getAttribute('data-align') ?? '';
    const isPinned = this.getAttribute('data-pinned') === 'true';
    const isPinnedLeftLast = this.getAttribute('data-pinned-left-last') === 'true';
    const isPinnedRightFirst = this.getAttribute('data-pinned-right-first') === 'true';
    const isFocused = this.getAttribute('data-focused') === 'true';
    const isEditing = this.getAttribute('data-editing') === 'true';

    this.className = [
      'body-cell',
      'ui-grid-cell',
      isOdd ? 'body-cell-odd' : '',
      align === 'center' ? 'align-center' : '',
      align === 'end' ? 'align-end' : '',
      isPinned ? 'is-pinned' : '',
      isPinnedLeftLast ? 'is-pinned-left-last' : '',
      isPinnedRightFirst ? 'is-pinned-right-first' : '',
      isFocused ? 'cell-focused' : '',
      isEditing ? 'cell-editing' : '',
    ].filter(Boolean).join(' ');

    this.tabIndex = 0;
  }

  static define(tagName = UIGridBodyCell.TAG): void {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, UIGridBodyCell);
    }
  }
}
