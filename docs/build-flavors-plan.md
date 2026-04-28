# ui-grid Build Flavors and Feature Flags Plan

## Goal

Add a build strategy that can produce smaller, use-case-specific ui-grid builds without forcing a full custom compiler rewrite.

The target is not arbitrary runtime toggles. The target is compile-time build shaping so consumers can ship only the feature slices they need when byte-performance matters.

## Short Answer

This is feasible, but only after the seam split refactor creates real module boundaries.

It is not massively prohibitively complex if it is built on top of:

- a framework-agnostic core
- side-effect-free feature modules
- stable packaging entry points
- a small number of supported build presets

It becomes expensive and fragile if attempted directly against the current monolithic Angular component and library surface.

## Implementation Status

Current progress as of the latest refactor pass:

- `scripts/build-library-preset.mjs` now exists as the first preset-aware library build wrapper
- `npm run build:library:preset -- --preset=full` now builds a generated preset entry through `ng-packagr` into `dist/ui-grid-full`
- the wrapper emits `dist/ui-grid-full/build-flavor.json` with the selected preset and feature list
- planned presets `minimal`, `data-heavy`, and `interactive` are defined and currently fail fast with explicit messages instead of attempting invalid builds
- the current supported preset is intentionally only `full` because the Angular adapter is still too coarse to deliver honest byte savings for slimmer presets
- one library-compatibility issue was fixed during this work by removing `Object.fromEntries` from the shared core so `ng-packagr` can compile the library target cleanly

## Current Constraint

Today, the build surface is still coarse:

- `angular.json` defines standard Angular application and custom-element builds
- `projects/ui-grid/ng-package.json` defines a normal `ng-packagr` library build
- `projects/ui-grid/src/public-api.ts` exports the current top-level library surface
- `UiGridComponent` still hosts a large amount of mixed rendering and engine behavior

That means normal bundling can tree-shake unused exports, but it cannot reliably compile away internal feature slices that are entangled inside the main component and pipeline host.

## Recommendation

Treat build-time slimming as a follow-on track within the seam split refactor.

The recommended order is:

1. split the engine into feature modules
2. make those modules side-effect-free
3. define supported feature presets
4. expose preset or feature-specific entry points
5. optionally add a thin build wrapper that accepts flags and generates the right entry file

This gives most of the byte savings without inventing a bespoke compiler.

## What “Flags” Should Mean

For this project, flags should mean compile-time feature selection, not runtime configuration.

### Good

- `--preset=minimal`
- `--preset=data-heavy`
- `--features=sorting,filtering,pagination`

### Not Good

- runtime booleans that still ship every feature implementation
- dozens of unsupported feature combinations with no compatibility guarantees
- feature gating that changes public API shapes unpredictably for consumers

## Recommended Product Model

Support two levels of build customization.

### Level 1: Presets

This should be the primary supported model.

Example presets:

- `minimal`
  - core rendering contract
  - sorting
  - filtering
  - pagination
- `data-heavy`
  - sorting
  - filtering
  - virtualization hooks
  - SSR visible window
  - export
- `interactive`
  - sorting
  - filtering
  - grouping
  - editing
  - tree
  - expandable rows
- `full`
  - all supported features

Presets are easier to document, test, and version.

### Level 2: Expert Feature Flags

Only add direct feature selection after presets are stable.

Example:

- `--features=sorting,filtering,export`

This should be treated as an expert mode because the compatibility surface and test matrix grow quickly when every combination is allowed.

## Required Refactor Preconditions

Before build flags are meaningful, the following conditions need to exist.

### 1. Feature Modules

Each feature must exist as an importable module rather than as a branch hidden inside a single component.

Target slices include:

- sorting
- filtering
- grouping
- pagination
- editing
- tree view
- expandable rows
- infinite scroll
- save-state
- export
- SSR viewport logic

### 2. Side-Effect-Free Core

Feature modules should not register themselves globally or rely on import-time side effects.

This is necessary so bundlers can remove unused modules safely.

### 3. Stable Composition Layer

There must be a single place where a build flavor composes the selected features into a grid core.

This composition layer is where presets and build flags should resolve.

## Proposed Architecture

## Layer 1: Core Feature Modules

Each feature exports:

- contracts
- state transitions
- pipeline hooks
- optional API extensions

Example shape:

```text
core/
  features/
    sorting/
    filtering/
    grouping/
    pagination/
    editing/
    tree/
    expandable/
    export/
    viewport/
```

## Layer 2: Preset Composition

Preset modules assemble chosen features.

Example shape:

```text
presets/
  minimal.ts
  data-heavy.ts
  interactive.ts
  full.ts
```

## Layer 3: Adapter Entry Points

Adapters consume a chosen preset or explicit feature composition.

Example shape:

```text
angular/
  presets/
    minimal.ts
    full.ts
  create-grid.ts
```

This keeps Angular-specific code from deciding which engine features exist.

## Packaging Strategy

The packaging strategy should evolve in stages.

### Stage A: Secondary Entry Points

This is the safest first packaging strategy.

Possible package surface:

- `@ornery/ui-grid/angular`
- `@ornery/ui-grid/core`
- `@ornery/ui-grid/presets/minimal`
- `@ornery/ui-grid/presets/full`
- `@ornery/ui-grid/features/sorting`

Benefits:

- works with standard bundling patterns
- easy to document
- avoids custom code generation first

### Stage B: Generated Entry Files

Add a build wrapper script that accepts a preset or feature list and generates an entry module before invoking the normal Angular or library build.

Example flow:

1. user runs a build command with `--preset` or `--features`
2. script resolves the feature manifest
3. script generates a temporary composition entry file
4. existing build pipeline packages that entry

Benefits:

- more flexibility
- still uses standard build tools underneath

### Stage C: Customer-Specific Build Automation

Only add this if there is proven demand.

This stage would support highly tailored builds for OEM or embedded scenarios where every kilobyte matters.

## Build Tool Recommendation

Do not replace the build system up front.

Keep Angular and `ng-packagr` as the packaging layer, and add a small orchestration script around them once the module graph supports it.

That script can live under `scripts/` and do three things:

- validate the requested preset or feature list
- generate a composition entry module
- invoke the existing build target

This is much cheaper than maintaining a custom compiler.

## Command Model

Recommended future command shapes:

```bash
npm run build:package -- --preset=full
npm run build:package -- --preset=minimal
npm run build:package -- --features=sorting,filtering,pagination
```

If the project later introduces Rust-backed core builds, the same manifest should drive those builds too.

## Public API Strategy

The public API must stay predictable.

That means:

- presets should be documented contracts
- unsupported feature combinations should fail fast
- missing features should be reflected through well-defined capability checks or omitted APIs, not silent no-ops

For example, if a pagination-free build is produced, the grid should not pretend pagination exists.

## Testing Strategy

This plan only works if the supported builds have disciplined test coverage.

Recommended test layers:

- core feature tests for each individual module
- preset integration tests for each supported preset
- adapter tests for Angular preset entry points
- bundle-size smoke checks for the byte-sensitive presets

Do not try to exhaustively test every theoretical feature combination.

Test:

- each individual feature
- each supported preset
- a small number of expert-mode combinations if expert mode is shipped

## Risks

### Risk: Flags without seams

If flags are added before features are modular, the project will gain complexity without meaningful size wins.

Mitigation:

- make build flavors a dependent milestone of the seam split refactor

### Risk: Test matrix explosion

Too many supported combinations will create high maintenance cost.

Mitigation:

- support a small preset set first
- treat arbitrary feature lists as expert mode only if there is real demand

### Risk: API fragmentation

Multiple builds can confuse consumers if capability differences are undocumented.

Mitigation:

- document each preset clearly
- keep naming simple and stable
- avoid hidden feature exclusions

### Risk: Weak byte savings

If features still share too much common infrastructure, the byte savings may be disappointing.

Mitigation:

- keep feature modules sharply isolated
- measure bundle impact per preset before expanding the strategy

## Success Criteria

This build-flavor plan is successful when:

- the project can ship at least one smaller preset build with meaningful byte savings
- the supported presets have stable documented capability sets
- the build process uses mostly standard Angular and packaging tools
- feature composition is driven by modular core boundaries, not template branches
- the same feature manifest can later inform Rust-backed builds if the engine moves to Rust

## Recommended Phases

## Phase 0: Seams First

Prerequisite work:

- complete the seam split of the core and feature modules

## Phase 1: Preset Definition

Deliverables:

- define the first 3 or 4 supported presets
- map each preset to exact feature modules

## Phase 2: Packaging Entry Points

Deliverables:

- add preset entry points
- validate tree-shaking and output size improvements

## Phase 3: Build Wrapper

Deliverables:

- add a script that accepts `--preset`
- optionally support `--features`

## Phase 4: Size Measurement

Deliverables:

- automated bundle-size reporting per preset
- threshold checks for the byte-sensitive targets

## Recommended Immediate Next Step

Do not start with flags.

The immediate next step is to make the seam split plan explicitly produce side-effect-free feature modules and a composition layer. Once that exists, build flavors become a reasonable packaging problem rather than a compiler problem.