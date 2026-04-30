import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CodeBlockComponent } from '../../shared/code-block.component';

@Component({
  selector: 'app-docs-rust',
  imports: [CodeBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="docs-topic">
      <h1>Rust / WASM</h1>
      <p class="docs-lead">
        UI Grid's core engine is being moved into Rust and exposed through WebAssembly. The easiest
        way to run that engine locally today is the browser-native vanilla demo.
      </p>

      <h2>What runs in Rust</h2>
      <ul>
        <li>Filtering, sorting, grouping, and pagination</li>
        <li>Tree flattening and virtualization math</li>
        <li>CSV export helpers and save-state normalization</li>
      </ul>

      <h2>Prerequisites</h2>
      <app-code-block lang="bash" [code]="prereqSnippet" />

      <h2>Install</h2>
      <app-code-block lang="bash" [code]="installSnippet" />

      <h2>Build the browser-native Rust artifact</h2>
      <app-code-block lang="bash" [code]="rustBuildSnippet" />

      <h2>Build the compiled UI Grid library</h2>
      <p>
        The vanilla demo intentionally consumes the compiled library output in
        <code>dist/ui-grid/</code>
        rather than raw Angular source files.
      </p>
      <app-code-block lang="bash" [code]="libraryBuildSnippet" />

      <h2>Run the local Rust-backed demo</h2>
      <p>
        This combined script builds the compiled library, rebuilds the browser-native WASM package,
        and starts the vanilla demo server.
      </p>
      <app-code-block lang="bash" [code]="runSnippet" />

      <h3>Open in the browser</h3>
      <app-code-block lang="text" [code]="urlSnippet" />

      <h2>Manual workflow</h2>
      <app-code-block lang="bash" [code]="manualSnippet" />

      <h2>What this demo proves</h2>
      <ul>
        <li>The Rust/WASM pipeline can run in a plain browser host</li>
        <li>The grid can mount without Angular or React application code</li>
        <li>Future Rust-framework wrappers can stay thin and reuse the same engine boundary</li>
      </ul>

      <h2>Validation</h2>
      <app-code-block lang="bash" [code]="validationSnippet" />

      <h2>Current limitation</h2>
      <p>
        This is not yet a desktop-native Rust UI app. The current local Rust path is a
        browser-native WASM demo backed by the Rust engine, which is the correct baseline for future
        Rust-framework wrappers.
      </p>
    </section>
  `,
  styles: `
    @use '../docs-topic';
  `,
})
export class DocsRustComponent {
  protected readonly prereqSnippet = `curl https://sh.rustup.rs -sSf | sh
cargo install wasm-pack`;

  protected readonly installSnippet = `npm ci
cd projects/ui-grid-vanilla && npm install && cd ../..`;

  protected readonly rustBuildSnippet = `npm run build:rust:web`;

  protected readonly libraryBuildSnippet = `npm run build:library`;

  protected readonly runSnippet = `npm run start:vanilla`;

  protected readonly urlSnippet = `http://127.0.0.1:4174/`;

  protected readonly manualSnippet = `npm run build:library
npm run build:rust:web
npm run start --prefix projects/ui-grid-vanilla -- --host 127.0.0.1 --port 4174`;

  protected readonly validationSnippet = `npm run test:angular -- --watch=false
npm run test:react
npm run test:vanilla
npm run build:rust:wasm
npm run build:rust:web`;
}
