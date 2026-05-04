import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { UiGrid, type UiGridProps } from './UiGrid';

export function mountUiGrid(container: Element | DocumentFragment, props: UiGridProps): Root {
  const root = createRoot(container);
  root.render(React.createElement(UiGrid, props));
  return root;
}

/** Re-render an already-mounted UiGrid root with new props (for live data updates). */
export function updateUiGrid(root: Root, props: UiGridProps): void {
  root.render(React.createElement(UiGrid, props));
}

/** Create a styled <span> React node — usable from non-TSX contexts (e.g. Angular). */
export function styledCell(
  text: string,
  color: string,
  extraStyle?: React.CSSProperties,
): React.ReactNode {
  return React.createElement(
    'span',
    { style: { color, fontVariantNumeric: 'tabular-nums', ...extraStyle } },
    text,
  );
}