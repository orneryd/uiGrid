#include <iostream>

#include "ui_grid.hpp"

int main() {
    ui_grid::Engine engine;
    engine.set_options_json(
        R"({"id":"ffi-grid","data":[{"id":"row-1","symbol":"AAPL","price":182.15}],"columnDefs":[{"name":"symbol"},{"name":"price"}],"enableSorting":true})"
    );
    engine.apply_sort({"price", ui_grid::SortDirection::desc});
    engine.apply_pinning({{{"symbol", ui_grid::PinTarget::left}}});

    const auto envelope = engine.projection_envelope_message_pack();
    std::cout << "engineContractVersion: " << envelope.engine_contract_version << '\n';
    std::cout << "cAbiVersion: " << envelope.c_abi_version << '\n';
    std::cout << "projectionSchemaVersion: " << envelope.projection_schema_version << '\n';
    std::cout << "commandSchemaVersion: " << envelope.command_schema_version << '\n';
    std::cout << "payloadBytes: " << envelope.payload_bytes.size() << '\n';
    return 0;
}