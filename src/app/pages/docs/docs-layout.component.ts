import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DocsGettingStartedComponent } from './topics/getting-started.component';
import { DocsFeaturesComponent } from './topics/features.component';
import { DocsThemingTopicComponent } from './topics/theming-topic.component';
import { DocsApiReferenceComponent } from './topics/api-reference.component';
import { DocsCellEditingComponent } from './topics/cell-editing.component';
import { DocsTreeViewComponent } from './topics/tree-view.component';
import { DocsExpandableRowsComponent } from './topics/expandable-rows.component';
import { DocsCustomBuildsComponent } from './topics/custom-builds.component';
import { DocsWebComponentComponent } from './topics/web-component.component';
import { DocsI18nComponent } from './topics/i18n.component';
import { DocsAccessibilityComponent } from './topics/accessibility.component';
import { DocsReactComponent } from './topics/react.component';
import { DocsRustComponent } from './topics/rust.component';
import { DocsRustEguiComponent } from './topics/rust-egui.component';

@Component({
  selector: 'app-docs-layout',
  imports: [
    RouterLink,
    DocsGettingStartedComponent,
    DocsFeaturesComponent,
    DocsThemingTopicComponent,
    DocsApiReferenceComponent,
    DocsCellEditingComponent,
    DocsTreeViewComponent,
    DocsExpandableRowsComponent,
    DocsCustomBuildsComponent,
    DocsWebComponentComponent,
    DocsI18nComponent,
    DocsAccessibilityComponent,
    DocsReactComponent,
    DocsRustComponent,
    DocsRustEguiComponent
  ],
  templateUrl: './docs-layout.component.html',
  styleUrl: './docs-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocsLayoutComponent {
  protected readonly topics = [
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'features', label: 'Features' },
    { id: 'theming', label: 'Theming' },
    { id: 'api-reference', label: 'API Reference' },
    { id: 'cell-editing', label: 'Cell Editing' },
    { id: 'tree-view', label: 'Tree View' },
    { id: 'expandable-rows', label: 'Expandable Rows' },
    { id: 'custom-builds', label: 'Custom Builds' },
    { id: 'web-component', label: 'Web Component' },
    { id: 'i18n', label: 'Internationalization' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'react', label: 'React' },
    { id: 'rust', label: 'Rust / WASM' },
    { id: 'rust-egui', label: 'Rust / egui' }
  ] as const;

  private readonly route = inject(ActivatedRoute);
  private readonly topicParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('topic'))),
    { initialValue: null }
  );

  protected readonly activeTopic = computed(() => this.topicParam() ?? 'getting-started');
}
