# ui-grid-lvgl

First native C adapter scaffold for `ui-grid-core`, built on top of `ui-grid-c-abi` and targeting [LVGL](https://lvgl.io/).

Current intent:

- prove the first foreign native widget adapter in C before branching to C++ and Go UI toolkits
- follow the host responsibilities learned from `ui-grid-egui`
- keep grid behavior in Rust and keep LVGL responsible only for widget creation, input capture, scroll plumbing, and painting

Current scope:

- opaque LVGL adapter that owns a `ui-grid-c-abi` engine instance
- coarse-grained update API for options, rows, and commands
- projection parser that reads `visibleColumns` and `displayItems` from the ABI JSON envelope and renders them into an LVGL table
- SDL-backed desktop demo that opens a real LVGL window, registers mouse and keyboard input, and drives the timer loop end to end

Why JSON first here:

- the widget contract is still being proven
- JSON keeps the first LVGL adapter easier to debug during host-behavior bring-up
- once the widget flow is stable, this adapter should move to the byte transport and prefer MessagePack for production refreshes

Planned follow-up:

1. replace the JSON prototype parser with a byte-codec projection path
2. split pinned regions into dedicated LVGL containers
3. add filtering, grouping, pagination, and row expansion interactions
4. add a demo app with richer fixture data and theme controls

## Build

This adapter fetches LVGL from upstream during CMake configure and uses SDL2 as the desktop backend.

```sh
brew install sdl2
cargo build -p ui-grid-c-abi
cmake -S crates/ui-grid-lvgl -B target/ui-grid-lvgl
cmake --build target/ui-grid-lvgl
```

## Demo

```sh
brew install sdl2
cargo build -p ui-grid-c-abi
cmake -S crates/ui-grid-lvgl -B target/ui-grid-lvgl
cmake --build target/ui-grid-lvgl

./target/ui-grid-lvgl/ui-grid-lvgl-demo
```

## Architecture Notes

The adapter takes its cues from `ui-grid-egui`:

- the host widget owns layout and event wiring
- sort/filter/group/pin/edit actions become ABI commands
- the Rust engine remains authoritative for projection and saved state
- the current prototype uses the JSON projection to make the host contract debuggable before transport tuning