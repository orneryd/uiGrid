import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { UiGrid, type UiGridProps } from './UiGrid';

export function mountUiGrid(container: Element | DocumentFragment, props: UiGridProps): Root {
  const root = createRoot(container);
  root.render(React.createElement(UiGrid, props));
  return root;
}