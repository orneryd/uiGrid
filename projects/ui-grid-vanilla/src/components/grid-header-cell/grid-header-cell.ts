/**
 * `<ui-grid-header-cell>` — Column header cell element.
 *
 * An autonomous custom element that manages CSS class and draggable state for
 * a single grid column header. Does NOT use shadow DOM or an HTML template.
 *
 * **Performance strategy:** Same as `<ui-grid-body-cell>` — the parent pre-renders
 * the full innerHTML (header label, sort/group/pin action buttons, resize handle)
 * as a string. This component only manages class names, draggable attribute, and
 * sticky positioning from data attributes.
 *
 * **Why no template:** Header cells contain complex conditional HTML (sort button
 * only if sorting enabled, pin menu only if pinning enabled, etc.). The parent
 * already builds this string with full context. Re-implementing that logic in a
 * template would duplicate code without benefit.
 *
 * @example
 * ```html
 * <ui-grid-header-cell
 *   data-column="name"
 *   data-sort-active="true"
 *   data-pinned="false"
 *   data-draggable="true">
 *   <span class="header-label">Name</span>
 *   <span class="header-actions">...</span>
 * </ui-grid-header-cell>
 * ```
 */
export class UIGridHeaderCell extends HTMLElement {
  static readonly TAG = 'ui-grid-header-cell';

  static get observedAttributes(): string[] {
    return ['data-column', 'data-sort-active', 'data-pinned',
            'data-pinned-left-last', 'data-pinned-right-first',
            'data-pin-menu-open', 'data-drag-target', 'data-dragging',
            'data-draggable', 'data-sticky-style'];
  }

  connectedCallback(): void {
    this.applyState();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.applyState();
    }
  }

  /** Compute CSS classes, draggable, and sticky style from data attributes. */
  private applyState(): void {
    const isSortActive = this.getAttribute('data-sort-active') === 'true';
    const isPinned = this.getAttribute('data-pinned') === 'true';
    const isPinnedLeftLast = this.getAttribute('data-pinned-left-last') === 'true';
    const isPinnedRightFirst = this.getAttribute('data-pinned-right-first') === 'true';
    const isPinMenuOpen = this.getAttribute('data-pin-menu-open') === 'true';
    const isDragTarget = this.getAttribute('data-drag-target') === 'true';
    const isDragging = this.getAttribute('data-dragging') === 'true';
    const isDraggable = this.getAttribute('data-draggable') === 'true';
    const stickyStyle = this.getAttribute('data-sticky-style') ?? '';

    this.className = [
      'header-cell',
      isSortActive ? 'is-active' : '',
      isPinned ? 'is-pinned' : '',
      isPinnedLeftLast ? 'is-pinned-left-last' : '',
      isPinnedRightFirst ? 'is-pinned-right-first' : '',
      isPinMenuOpen ? 'is-pin-menu-open' : '',
      isDragTarget ? 'is-drag-target' : '',
      isDragging ? 'is-dragging' : '',
    ].filter(Boolean).join(' ');

    if (isDraggable) {
      this.setAttribute('draggable', 'true');
    } else {
      this.removeAttribute('draggable');
    }

    if (stickyStyle) {
      this.setAttribute('style', stickyStyle);
    }
  }

  static define(tagName = UIGridHeaderCell.TAG): void {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, UIGridHeaderCell);
    }
  }
}
