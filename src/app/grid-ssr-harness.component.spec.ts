import { bootstrapApplication } from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import {
  GridSsrHarnessComponent,
  SSR_HARNESS_ROW_COUNT,
  SSR_HARNESS_VISIBLE_ROW_COUNT
} from './grid-ssr-harness.component';

describe('GridSsrHarnessComponent', () => {
  it('renders only the viewport-visible virtual rows during SSR and reports timing', async () => {
    const startedAt = performance.now();
    const html = await renderApplication(
      (context) => bootstrapApplication(GridSsrHarnessComponent, {
        providers: [provideServerRendering()]
      }, context),
      {
        document: '<!doctype html><html><body><app-grid-ssr-harness></app-grid-ssr-harness></body></html>',
        url: 'http://localhost/ssr-harness'
      }
    );
    const durationMs = performance.now() - startedAt;

    const renderedRowIds = [...html.matchAll(/data-row-id="([^"]+)"/g)].map((match) => match[1]);
    const uniqueRowIds = [...new Set(renderedRowIds)];
    const expectedRowIds = Array.from({ length: SSR_HARNESS_VISIBLE_ROW_COUNT }, (_value, index) => `ssr-row-${index + 1}`);

    expect(uniqueRowIds).toEqual(expectedRowIds);
    expect(html).not.toContain(`ssr-row-${SSR_HARNESS_VISIBLE_ROW_COUNT + 1}`);
    expect(html).not.toContain('cdk-virtual-scroll-viewport');

    console.info(
      `[SSR harness] Rendered ${uniqueRowIds.length}/${SSR_HARNESS_ROW_COUNT} visible rows in ${durationMs.toFixed(2)} ms (${html.length} HTML chars).`
    );
  });
});