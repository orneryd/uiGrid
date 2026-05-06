# ui-grid-cpp

Thin C++ wrapper over `ui-grid-c-abi`.

Current scope:

- RAII lifecycle wrapper around the opaque engine handle
- string ownership helpers for ABI-returned buffers
- byte-buffer ownership helpers for ABI-returned buffers
- pass-through JSON lifecycle helpers for options, rows, commands, projection, and state
- codec-aware byte transport helpers
- typed sort/group/pin command builders layered over the JSON ABI
- `ProjectionEnvelopeJson` helper for inspecting the JSON envelope without hand-rolled parsing
- `ProjectionEnvelopeMessagePack` helper for inspecting the MessagePack envelope metadata and payload bytes

Current command DTO JSON shapes:

- sort: `{"kind":"setSort","columnName":"price","direction":"asc"}`
- grouping: `{"kind":"setGrouping","groupBy":["sector","status"]}`
- pinning: `{"kind":"setPinnedColumns","pinnedColumns":{"symbol":"left"}}`

Smoke example build flow after `cargo build -p ui-grid-c-abi`:

```sh
clang++ -std=c++20 \
  -I crates/ui-grid-c-abi/include \
  -I crates/ui-grid-cpp/include \
  crates/ui-grid-cpp/examples/smoke.cpp \
  target/debug/libui_grid_c_abi.a \
  -o target/ui-grid-cpp-smoke

./target/ui-grid-cpp-smoke
```

Typed convenience layer:

- `ui_grid::SortCommand` with `ui_grid::SortDirection`
- `ui_grid::GroupingCommand`
- `ui_grid::PinColumnsCommand` with `ui_grid::PinTarget`
- `ui_grid::ProjectionEnvelopeJson::parse(...)` and `engine.projection_envelope_json()`
- `ui_grid::ProjectionEnvelopeMessagePack::parse(...)` and `engine.projection_envelope_message_pack()`

The wrapper still speaks JSON across the ABI boundary; these helpers only build the command payloads safely on the C++ side.

Available codecs:

- `ui_grid::Codec::json`
- `ui_grid::Codec::message_pack`

CMake smoke target:

```sh
cargo build -p ui-grid-c-abi
cmake -S crates/ui-grid-cpp -B target/ui-grid-cpp-cmake
cmake --build target/ui-grid-cpp-cmake

./target/ui-grid-cpp-cmake/ui-grid-cpp-smoke
```

MessagePack envelope smoke target:

```sh
cargo build -p ui-grid-c-abi
clang++ -std=c++20 \
  -I crates/ui-grid-c-abi/include \
  -I crates/ui-grid-cpp/include \
  crates/ui-grid-cpp/examples/smoke_message_pack.cpp \
  target/debug/libui_grid_c_abi.a \
  -o target/ui-grid-cpp-message-pack-smoke

./target/ui-grid-cpp-message-pack-smoke
```