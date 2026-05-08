/**
 * JSX type augmentation for the `<ui-grid-element>` custom element.
 *
 * The React wrapper in this package renders the web component directly as
 * a React child. Depending on how a consumer's build resolves React types
 * (global JSX vs. `React.JSX` namespace in React 19+), the right
 * `IntrinsicElements` slot lives in one of two places — we augment both so
 * the declaration lands everywhere.
 */

import type * as React from 'react';
import type { UiGridStandaloneElement } from '@ornery/ui-grid-vanilla';

type UiGridElementProps = React.DetailedHTMLProps<
  React.HTMLAttributes<UiGridStandaloneElement>,
  UiGridStandaloneElement
> & { ref?: React.Ref<UiGridStandaloneElement> };

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'ui-grid-element': UiGridElementProps;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ui-grid-element': UiGridElementProps;
    }
  }
}

export {};
