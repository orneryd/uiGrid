#include <iostream>

#include "ui_grid.hpp"

int main() {
    ui_grid::Engine engine;
    engine.set_options_json(
        R"({"id":"ffi-grid","data":[{"id":"row-1","symbol":"AAPL","price":182.15}],"columnDefs":[{"name":"symbol"},{"name":"price"}],"enableSorting":true})"
    );
    engine.apply_sort({"price", ui_grid::SortDirection::desc});
    engine.apply_grouping({{"symbol"}});
    engine.apply_pinning({{{"symbol", ui_grid::PinTarget::left}}});

    std::cout << "abiVersion: " << ui_grid::Engine::abi_version() << '\n';
    std::cout << "projectionSchemaVersion: " << ui_grid::Engine::projection_schema_version()
              << '\n';
    std::cout << "commandSchemaVersion: " << ui_grid::Engine::command_schema_version() << '\n';
    std::cout << "projection: " << engine.projection_json() << '\n';

    std::string saved_state = engine.save_state_json();
    std::cout << "savedState: " << saved_state << '\n';
    engine.restore_state_json(saved_state);
    engine.set_rows_json(
        R"([{"id":"row-1","symbol":"AAPL","price":183.45},{"id":"row-2","symbol":"MSFT","price":421.3}])"
    );
    std::cout << "projectionAfterRows: " << engine.projection_json() << '\n';
    return 0;
}