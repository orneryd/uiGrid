# ui-grid-c-abi

Stable C-facing wrapper over `ui-grid-core`.

Current scope:

- opaque engine lifecycle
- codec-aware byte transport at the ABI boundary
- JSON options and rows input helpers
- JSON command input helpers
- JSON projection output helpers
- JSON save/restore state helpers
- explicit string ownership via `ui_grid_string_free`
- explicit byte-buffer ownership via `ui_grid_buffer_free`

Transport design:

- `ui-grid-core` stays transport-agnostic and continues to work with typed Rust models
- the ABI layer owns wire-format concerns
- JSON remains the canonical first codec for debugging and contract stabilization
- alternative codecs should be added here as byte-buffer transports, not as core-level serializer hooks

Current ABI codec values:

- `UI_GRID_CODEC_JSON = 1`
- `UI_GRID_CODEC_MESSAGE_PACK = 2`

Current codec posture:

- JSON is the reference path for debugging, examples, and contract stabilization
- MessagePack is the first binary codec on the byte transport and should remain payload-compatible with the normalized JSON projection/state surfaces

Current command DTO JSON shapes:

- sort: `{"kind":"setSort","columnName":"price","direction":"asc"}`
- grouping: `{"kind":"setGrouping","groupBy":["sector","status"]}`
- pinning: `{"kind":"setPinnedColumns","pinnedColumns":{"symbol":"left"}}`

Tiny C smoke example build flow:

```sh
cargo build -p ui-grid-c-abi

cc \
  -I crates/ui-grid-c-abi/include \
  crates/ui-grid-c-abi/examples/smoke.c \
  target/debug/libui_grid_c_abi.a \
  -o target/ui-grid-c-smoke

./target/ui-grid-c-smoke
```

MessagePack C smoke example build flow:

```sh
cargo build -p ui-grid-c-abi

cc \
  -I crates/ui-grid-c-abi/include \
  crates/ui-grid-c-abi/examples/smoke_message_pack.c \
  target/debug/libui_grid_c_abi.a \
  -o target/ui-grid-c-message-pack-smoke

./target/ui-grid-c-message-pack-smoke
```

Projection transport benchmark:

```sh
cargo run -p ui-grid-c-abi --example projection_benchmark
```

That benchmark now reports both projection transport and saved-state transport for JSON vs MessagePack.

Ownership rules:

- any `char *` returned by the ABI is Rust-owned and must be released with `ui_grid_string_free`
- any `uint8_t *` returned by the ABI is Rust-owned and must be released with `ui_grid_buffer_free`
- the engine handle returned by `ui_grid_engine_create` must be released with `ui_grid_engine_destroy`
- JSON input pointers remain caller-owned for the duration of the call

Recommended usage:

- use the JSON helpers while the contract is still stabilizing
- use the byte-oriented APIs when adding the next codec so the public ABI does not need another shape change