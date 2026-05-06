#include <stdio.h>
#include <stdlib.h>

#include "ui_grid_c_abi.h"

static void print_and_free(const char *label, char *value) {
    if (value == NULL) {
        fprintf(stderr, "%s: <null>\n", label);
        return;
    }

    printf("%s: %s\n", label, value);
    ui_grid_string_free(value);
}

static int fail_with_last_error(UiGridAbiEngine *engine, const char *label) {
    char *error = ui_grid_engine_last_error_message(engine);
    fprintf(stderr, "%s failed: %s\n", label, error != NULL ? error : "<unknown>");
    if (error != NULL) {
        ui_grid_string_free(error);
    }
    return 1;
}

int main(void) {
    UiGridAbiEngine *engine = ui_grid_engine_create();
    if (engine == NULL) {
        fprintf(stderr, "engine creation failed\n");
        return 1;
    }

    const char *options_json =
        "{"
        "\"id\":\"ffi-grid\"," 
        "\"data\":[{\"id\":\"row-1\",\"symbol\":\"AAPL\",\"price\":182.15}],"
        "\"columnDefs\":[{\"name\":\"symbol\"},{\"name\":\"price\"}],"
        "\"enableSorting\":true"
        "}";

    if (!ui_grid_engine_set_options_json(engine, options_json)) {
        int code = fail_with_last_error(engine, "set_options_json");
        ui_grid_engine_destroy(engine);
        return code;
    }

    if (!ui_grid_engine_apply_command_json(
            engine,
            "{\"kind\":\"setSort\",\"columnName\":\"price\",\"direction\":\"desc\"}")) {
        int code = fail_with_last_error(engine, "apply_command_json");
        ui_grid_engine_destroy(engine);
        return code;
    }

    print_and_free("abiVersion", ui_grid_abi_version());
    print_and_free("projectionSchemaVersion", ui_grid_projection_schema_version());
    print_and_free("commandSchemaVersion", ui_grid_command_schema_version());
    print_and_free("projection", ui_grid_engine_get_projection_json(engine));

    char *saved_state = ui_grid_engine_save_state_json(engine);
    if (saved_state == NULL) {
        int code = fail_with_last_error(engine, "save_state_json");
        ui_grid_engine_destroy(engine);
        return code;
    }

    printf("savedState: %s\n", saved_state);
    if (!ui_grid_engine_restore_state_json(engine, saved_state)) {
        ui_grid_string_free(saved_state);
        int code = fail_with_last_error(engine, "restore_state_json");
        ui_grid_engine_destroy(engine);
        return code;
    }
    ui_grid_string_free(saved_state);

    const char *rows_json =
        "[{\"id\":\"row-1\",\"symbol\":\"AAPL\",\"price\":183.45},"
        "{\"id\":\"row-2\",\"symbol\":\"MSFT\",\"price\":421.30}]";
    if (!ui_grid_engine_set_rows_json(engine, rows_json)) {
        int code = fail_with_last_error(engine, "set_rows_json");
        ui_grid_engine_destroy(engine);
        return code;
    }

    print_and_free("projectionAfterRows", ui_grid_engine_get_projection_json(engine));
    ui_grid_engine_destroy(engine);
    return 0;
}