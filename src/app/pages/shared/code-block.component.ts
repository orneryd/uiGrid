import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-code-block',
  template: `<pre [attr.data-lang]="lang()"><code>{{ code() }}</code></pre>`,
  styles: `
    :host { display: block; }
    pre {
      margin: 0;
      padding: 1rem 1.25rem;
      border-radius: 8px;
      border: 1px solid var(--card-border, rgba(0, 0, 0, 0.1));
      background: var(--panel-surface-strong, #1a1a2e);
      overflow-x: auto;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--ink-strong, #e0e0e0);
    }
    pre::before {
      content: attr(data-lang);
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--teal-strong, #5eead4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodeBlockComponent {
  readonly code = input.required<string>();
  readonly lang = input<string>();
}
