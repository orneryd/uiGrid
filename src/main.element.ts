import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';
import { UiGridComponent } from '@ornery/ui-grid';

async function bootstrapElement(): Promise<void> {
  const application = await createApplication();
  const element = createCustomElement(UiGridComponent, {
    injector: application.injector
  });

  if (!customElements.get('ui-grid-element')) {
    customElements.define('ui-grid-element', element);
  }
}

void bootstrapElement();
