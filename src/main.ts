import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { enableUiGridWasmEngine } from '../projects/ui-grid/src/lib/grid/ui-grid.engine.wasm';

void enableUiGridWasmEngine()
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
