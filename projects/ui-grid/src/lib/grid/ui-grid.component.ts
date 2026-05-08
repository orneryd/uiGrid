import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EmbeddedViewRef,
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
import type {
  FrameworkCellSlot,
  FrameworkSlotDelta,
} from '@ornery/ui-grid-vanilla';
import type {
  GridCellTemplateContext,
  GridColumnDef,
  GridOptions,
  GridTemplateRefLike,
  UiGridApi,
} from '@ornery/ui-grid-core';

const TAG_NAME = 'ui-grid-element';

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
  private readonly appRef = inject(ApplicationRef);

  private gridElement: UiGridStandaloneElement | null = null;
  private elementReady = false;
  private listenerAttached = false;
  private slotViews = new Map<string, EmbeddedViewRef<GridCellTemplateContext>>();
  private templateColumns = new Map<string, GridTemplateRefLike<GridCellTemplateContext>>();

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
    this.destroyAllSlotViews();

    if (this.gridElement) {
      this.gridElement.removeEventListener('cellSlotsChanged', this.onCellSlotsChanged);
      this.gridElement.remove();
      this.gridElement = null;
    }
  }

  private applyOptions(opts: GridOptions): void {
    const el = this.gridElement!;

    this.zone.runOutsideAngular(() => {
      // Extract Angular TemplateRef columns
      const cellSlotColumns: string[] = [];
      this.templateColumns.clear();

      if (opts.columnDefs) {
        for (const col of opts.columnDefs) {
          if (col.cellTemplate?.createEmbeddedView) {
            cellSlotColumns.push(col.name);
            this.templateColumns.set(col.name, col.cellTemplate);
          }
        }
      }

      // Register the event listener once
      if (!this.listenerAttached) {
        el.addEventListener('cellSlotsChanged', this.onCellSlotsChanged);
        this.listenerAttached = true;
      }

      // Destroy existing slot views — the new render pass will recreate them
      this.destroyAllSlotViews();

      // Strip cellTemplate from columnDefs before passing to the element
      const cleanedColumnDefs: GridColumnDef[] | undefined = opts.columnDefs?.map((col) => {
        if (col.cellTemplate?.createEmbeddedView) {
          const { cellTemplate: _removed, ...rest } = col;
          return rest as GridColumnDef;
        }
        return col;
      });

      const wrappedOptions: GridOptions = {
        ...opts,
        columnDefs: cleanedColumnDefs,
        onRegisterApi: (api) => {
          this.zone.run(() => this.apiReady.emit(api as UiGridApi));
          opts.onRegisterApi?.(api);
        },
      };

      // Set options first so the element has data, then configure framework
      // slots — the re-render triggered by setFrameworkRenderedSlots will
      // emit all template cells as `added` in the cellSlotsChanged event.
      el.options = wrappedOptions;
      el.setFrameworkRenderedSlots({ cells: cellSlotColumns });
    });
  }

  private destroyAllSlotViews(): void {
    const el = this.gridElement;
    for (const view of this.slotViews.values()) {
      this.appRef.detachView(view);
      view.destroy();
    }
    this.slotViews.clear();
    // Remove projected light-DOM slot wrappers
    if (el) {
      el.querySelectorAll(':scope > [slot]').forEach((node) => node.remove());
    }
  }

  private readonly onCellSlotsChanged = (event: Event): void => {
    const detail = (event as CustomEvent<FrameworkSlotDelta<FrameworkCellSlot>>).detail;
    const el = this.gridElement!;

    for (const slot of detail.removed) {
      const view = this.slotViews.get(slot.slotName);
      if (view) {
        this.appRef.detachView(view);
        view.destroy();
        this.slotViews.delete(slot.slotName);
      }
      el.querySelector(`:scope > [slot="${slot.slotName}"]`)?.remove();
    }

    for (const slot of detail.added) {
      const templateRef = this.templateColumns.get(slot.columnName);
      if (!templateRef?.createEmbeddedView) continue;

      const viewRef = templateRef.createEmbeddedView(slot.context) as EmbeddedViewRef<GridCellTemplateContext>;
      this.appRef.attachView(viewRef);
      viewRef.detectChanges();

      const wrapper = document.createElement('span');
      wrapper.setAttribute('slot', slot.slotName);
      for (const node of viewRef.rootNodes) {
        wrapper.appendChild(node);
      }
      el.appendChild(wrapper);

      const oldView = this.slotViews.get(slot.slotName);
      if (oldView) {
        this.appRef.detachView(oldView);
        oldView.destroy();
      }
      this.slotViews.set(slot.slotName, viewRef);
    }
  };
}
