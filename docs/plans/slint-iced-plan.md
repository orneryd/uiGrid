**Goal**
Add two new native backends, Iced and Slint, while preserving one canonical grid model and API.  
For Slint, use an AngularJS ui-grid style mapping (options + column defs + API callbacks + templates), not an egui-immediate rendering style.

**Execution Plan (4 milestones)**

1. Milestone 1 : Shared Adapter Contract
1. Define a backend-agnostic renderer interface in core:
1. Grid host lifecycle (init, frame/update, dispose)
1. Input events (keyboard, pointer, focus)
1. Viewport + virtualization hooks
1. Cell rendering hooks (text, widget, custom template slot)
1. Freeze portable API surface:
1. id, data, columnDefs, sorting, filtering, pagination, selection, editing
1. onRegisterApi event contract
1. Save/restore grid state
1. Add parity matrix document:
1. Exact parity
1. Near parity
1. Backend-specific behavior

Deliverables:

1. Adapter trait(s) merged
2. Portable API checklist complete
3. Feature parity matrix draft

Exit criteria:

1. Existing egui backend compiles against new contract
2. No behavior regressions in shared core tests

3. Milestone 2: Iced Backend (Preview)
4. Create ui-grid-iced crate:
5. Data grid shell + scroll container
6. Header + body rendering
7. Selection + keyboard navigation
8. Add feature modules in order:
9. Sorting
10. Filtering
11. virtual scrolling
12. Pagination
13. Tree View
14. row expansion/master detail
15. Cell edit commit/cancel pipeline
16. Custom cell controls for edit and rendering.
17. Wire API callbacks:
18. Save/restore state
19. onRegisterApi
20. overridable controls labels to support i18n, a11y.

Deliverables:

1. Working Iced demo app
2. Preview backend crate
3. Behavior tests for top 4 features

Exit criteria:

1. Core feature parity at least 70% with egui
2. Keyboard and edit flows stable

3. Milestone 3: Slint Backend (AngularJS-style mapping)
4. Create ui-grid-slint crate with declarative architecture:
5. GridOptions mapped to root view model properties
6. ColumnDefs mapped to a column model
7. GridApi mapped to callback bridge methods
8. Template strategy (declarative, not immediate):
9. Header template region
10. Cell template region
11. Detail/expandable row region
12. Data flow:
13. Rust core state is source of truth
14. Slint bindings observe projected view state
15. User actions dispatch commands back to Rust core

Deliverables:

1. Slint demo with sorting/filtering/editing
2. AngularJS-structure mapping guide
3. Callback bridge for API parity

Exit criteria:

1. Slint can run same grid options model as egui/Iced for core features
2. No backend-specific API leakage in shared model

3. Milestone 4: Hardening, Docs, Release
4. Parity and regression test pass:
5. Shared behavior tests across egui, Iced, Slint
6. Backend-specific interaction tests
7. Performance pass:
8. Virtualization windowing benchmarks
9. Large dataset stress tests
10. Release prep:
11. Feature parity table published
12. Known differences documented
13. Preview tags for ui-grid-iced and ui-grid-slint

Deliverables:

1. Preview release for both backends
2. Documentation and examples
3. Migration notes and known limitations

Exit criteria:

1. All existing features available to all grids across the suite are feature complete on both backends and tested.
2. CI green for core and both new backends

**Architecture Decisions (Concrete)**

1. Keep one canonical engine
1. All business logic, state transitions, and feature rules stay in core.
1. Backends only adapt rendering + event plumbing.

1. Iced mapping
1. Use message-driven update loop.
1. Map grid events to messages and reducers.
1. Keep API naming close to egui/core where possible.

1. Slint mapping
1. Use AngularJS-like structure:
1. options as top-level config object
1. columnDefs as declarative column model
1. api registration and callback hooks
1. template slots for cell/header/detail customization
1. Avoid immediate-mode patterns in Slint adapter.

**Risk Controls**

1. Risk: Backend divergence in behavior
1. Mitigation: shared conformance test suite + parity matrix gating

1. Risk: Virtualization complexity in Slint
1. Mitigation: start with windowed model adapter in Rust, keep Slint purely declarative

1. Risk: API drift from egui
1. Mitigation: portable API freeze and explicit backend-extension namespaces

**Suggested Task Breakdown (ready for tickets)**

1. Define backend adapter traits and shared event model
2. Implement Iced shell with sort/filter/page/select/edit
3. Implement Slint view model and callback bridge
4. Add shared conformance tests
5. Add backend demos and docs
6. Add parity table and release checklist
