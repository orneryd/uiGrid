import { defineUiGridRustElement } from '@ornery/ui-grid';

async function bootstrapElement(): Promise<void> {
  await defineUiGridRustElement();
}

void bootstrapElement();
