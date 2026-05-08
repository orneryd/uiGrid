import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import {
  defineStandaloneUiGridElement,
  UiGridStandaloneElement,
} from '@ornery/ui-grid-vanilla';
import type { GridOptions, UiGridApi } from '@ornery/ui-grid-core';

const TAG_NAME = 'ui-grid-element';

/**
 * Thin Angular wrapper around the vanilla `<ui-grid-element>` web component.
 *
 * This component is a pure API proxy:
 *   - It hosts a single `<ui-grid-element>` inside its own host element.
 *   - It forwards `options` to the element and surfaces the `UiGridApi`
 *     via the `apiReady` output.
 *   - It never inspects, patches, or re-renders the element's subtree —
 *     Angular is explicitly told to leave the element alone via
 *     `ngSkipHydration`, `CUSTOM_ELEMENTS_SCHEMA`, and by doing all DOM
 *     work outside `NgZone`.
 *
 * Consumers that need cell/header/expandable templates should configure
 * them via the existing vanilla `<template slot="…">` workflow on their
 * own markup, or reach `gridApi` directly — this wrapper deliberately
 * does not project Angular `TemplateRef`s into the grid.
 */
@Component({
  selector: 'app-ui-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styleUrl: './ui-grid.component.scss',
  host: {
    ngSkipHydration: 'true',
  },
  template: ``,
})
export class UiGridComponent implements AfterViewInit, OnDestroy {
  readonly options = input<GridOptions>({
    id: '__ui-grid-pending__',
    data: [],
    columnDefs: [],
  });

  readonly apiReady = output<UiGridApi>();

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  private gridElement: UiGridStandaloneElement | null = null;
  private elementReady = false;

  constructor() {
    effect(() => {
      const opts = this.options();
      untracked(() => {
        if (!this.elementReady || !this.gridElement) return;
        this.applyOptions(opts);
      });
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    await this.zone.runOutsideAngular(async () => {
      await defineStandaloneUiGridElement(TAG_NAME);

      const el = document.createElement(TAG_NAME) as UiGridStandaloneElement;
      this.gridElement = el;
      this.hostRef.nativeElement.appendChild(el);

      this.applyOptions(this.options());
      this.elementReady = true;
    });
  }

  ngOnDestroy(): void {
    if (this.gridElement) {
      this.gridElement.remove();
      this.gridElement = null;
    }
  }

  private applyOptions(opts: GridOptions): void {
    const el = this.gridElement!;

    this.zone.runOutsideAngular(() => {
      const wrappedOptions: GridOptions = {
        ...opts,
        onRegisterApi: (api) => {
          // Re-enter the Angular zone only for the `apiReady` emission so
          // consumers can update signals safely. The grid itself continues
          // to run outside the zone.
          this.zone.run(() => this.apiReady.emit(api as UiGridApi));
          opts.onRegisterApi?.(api);
        },
      };

      el.options = wrappedOptions;
    });
  }
}
