# Rust / WASM

UI Grid's deterministic engine is being moved into Rust and exposed through WebAssembly.

Today, the easiest way to run that Rust-backed engine locally is the browser-native demo in `projects/ui-grid-vanilla/`. That demo mounts the grid as a custom element, registers the Rust/WASM pipeline, and lets you interact with sorting, filtering, grouping, virtualization, and CSV export directly in the browser.

## What runs in Rust today

The Rust/WASM engine currently owns the deterministic pipeline work:

- filtering
- sorting
- grouping
- tree flattening
- pagination
- virtualization/window math
- CSV export helpers
- save-state normalization

The Angular, React, and vanilla/browser hosts remain thin adapters around that engine.

## Prerequisites

- Node.js 22+
- npm 11+
- Rust stable via `rustup`
- `wasm-pack`

If you do not already have the Rust toolchain and `wasm-pack` installed:

```bash
curl https://sh.rustup.rs -sSf | sh
cargo install wasm-pack
```

## Install dependencies

From the repo root:

```bash
npm ci
cd projects/ui-grid-vanilla && npm install && cd ../..
```

## Build the Rust browser artifact

Build the browser-native WASM package used by the vanilla demo:

```bash
npm run build:rust:web
```

This writes the browser-targeted WASM package to:

```text
dist/ui-grid-wasm-web/
```

## Build the compiled library entry

The vanilla demo intentionally consumes the compiled Angular library output rather than raw source files.

```bash
npm run build:library
```

This writes the compiled package to:

```text
dist/ui-grid/
```

## Run the Rust-backed browser demo

From the repo root:

```bash
npm run start:vanilla
```

That command builds the compiled library, rebuilds the browser-native Rust/WASM package, and starts the vanilla demo server.

Open this URL in your browser:

```text
http://127.0.0.1:4174/
```

You should see the `UI Grid Vanilla Demo` page with live grid data rendered in the browser.

## Manual workflow

If you want tighter control over each step instead of using the combined script:

```bash
npm run build:library
npm run build:rust:web
npm run start --prefix projects/ui-grid-vanilla -- --host 127.0.0.1 --port 4174
```

## What the vanilla demo is proving

The vanilla demo is the framework-agnostic baseline for future Rust-native wrappers.

It proves that:

- the Rust/WASM pipeline can be loaded directly in a browser host
- the grid can be mounted without Angular or React host application code
- thin wrappers for future Rust UI frameworks can target the same engine boundary

## Useful validation commands

```bash
npm run test:angular -- --watch=false
npm run test:react
npm run test:vanilla
npm run build:rust:wasm
npm run build:rust:web
```

## Current limitation

This is not yet a desktop-native Rust UI app. The current local "Rust app" path is a browser-native WASM demo backed by the Rust engine.

That is the correct baseline for the next phase: adding thin wrappers for Rust-specific UI frameworks without duplicating the grid engine.