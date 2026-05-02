import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';

import { enableUiGridWasmEngine } from '@ornery/ui-grid-core';
import { UiGridComponent } from './ui-grid.component';

const elementDefinitions = new Map<string, Promise<void>>();

export async function defineUiGridElement(tagName = 'ui-grid-element'): Promise<void> {
  if (customElements.get(tagName)) {
    return;
  }

  const pendingDefinition = elementDefinitions.get(tagName);
  if (pendingDefinition) {
    return pendingDefinition;
  }

  const definition = createApplication().then((application) => {
    const element = createCustomElement(UiGridComponent, {
      injector: application.injector,
    });

    if (!customElements.get(tagName)) {
      customElements.define(tagName, element);
    }
  });

  elementDefinitions.set(tagName, definition);

  try {
    await definition;
  } catch (error) {
    elementDefinitions.delete(tagName);
    throw error;
  }
}

export async function defineUiGridRustElement(tagName = 'ui-grid-element'): Promise<void> {
  await enableUiGridWasmEngine();
  await defineUiGridElement(tagName);
}
