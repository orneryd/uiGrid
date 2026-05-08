/**
 * Auto-resize port of the original `ui.grid.autoResize` module.
 *
 * The old Angular 1 module attached a directive (`ui-grid-auto-resize`) that
 * watched the host element's width + height via `gridUtil.elementWidth/
 * elementHeight`, debounced updates by 400ms, wrote `grid.gridWidth` /
 * `grid.gridHeight`, queued a refresh, and raised
 * `gridDimensionChanged(prevHeight, prevWidth, height, width)` on the
 * gridApi. Hidden hosts (no `offsetParent`) were skipped.
 *
 * The modern port wires the same behavior onto the vanilla element via a
 * ResizeObserver. Default is **on** — opt out with
 * `GridOptions.enableAutoResize: false`. When `options.viewportHeight` is
 * set explicitly, it still wins; the observed host size fills in as the
 * fallback so the grid defaults to filling its container.
 */

import { observeGridHostSize } from '@ornery/ui-grid-core';
import type { UiGridStandaloneElement } from './ui-grid-standalone.element';

/** Debounce window matches the old `gridUtil.debounce(refreshGrid, 400)`. */
const DEBOUNCE_MS = 400;

/**
 * Start observing the element's host size. Idempotent — safe to call from
 * `connectedCallback` even if the observer is already attached. Honors the
 * `enableAutoResize: false` opt-out on the element's active options, and
 * skips re-renders when the host has no `offsetParent` (hidden).
 */
export function startAutoResize(el: UiGridStandaloneElement): void {
  if (el.autoResizeObserver) return;
  if (el.activeOptions?.enableAutoResize === false) return;
  if (typeof ResizeObserver === 'undefined') return;

  el.autoResizeObserver = observeGridHostSize(el, ({ height, width }) => {
    if (el.offsetParent === null) return; // hidden host — match the old guard.
    if (height === el.lastMeasuredHostHeight && width === el.lastMeasuredHostWidth) return;

    if (el.autoResizeDebounceHandle !== null) {
      window.clearTimeout(el.autoResizeDebounceHandle);
    }
    el.autoResizeDebounceHandle = window.setTimeout(() => {
      el.autoResizeDebounceHandle = null;
      applyAutoResizeDimensions(el, height, width);
    }, DEBOUNCE_MS);
  });
}

/** Stop observing + cancel any pending debounce. Called from
 * `disconnectedCallback`. */
export function stopAutoResize(el: UiGridStandaloneElement): void {
  el.autoResizeObserver?.disconnect();
  el.autoResizeObserver = null;
  if (el.autoResizeDebounceHandle !== null) {
    window.clearTimeout(el.autoResizeDebounceHandle);
    el.autoResizeDebounceHandle = null;
  }
}

/**
 * Commit a new measured size: update the element's cached fields, trigger a
 * re-render if this isn't the initial measurement, and raise
 * `gridDimensionChanged(prevHeight, prevWidth, height, width)` on the
 * gridApi. Signature mirrors the old `ui.grid.autoResize` `refreshGrid`.
 */
function applyAutoResizeDimensions(
  el: UiGridStandaloneElement,
  height: number,
  width: number,
): void {
  const prevHeight = el.lastMeasuredHostHeight;
  const prevWidth = el.lastMeasuredHostWidth;
  el.lastMeasuredHostHeight = height;
  el.lastMeasuredHostWidth = width;
  el.autoViewportHeight = height;
  el.autoViewportWidth = width;

  // Only re-render after the initial measurement — the first observer call
  // fires during layout of the freshly-mounted element, before the first
  // render has even committed. Letting that trigger a re-render would
  // double-render for every mount.
  if (prevHeight > 0 || prevWidth > 0) {
    el.render();
  }

  if (el.controller?.gridApi) {
    el.controller.gridApi.core.raise.gridDimensionChanged(
      prevHeight,
      prevWidth,
      height,
      width,
    );
  }
}
