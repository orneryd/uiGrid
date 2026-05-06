#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#include "ui_grid_c_abi.h"

static const uint8_t OPTIONS_MESSAGE_PACK[] = {
    0x84,
    0xa2, 0x69, 0x64,
    0xa8, 0x66, 0x66, 0x69, 0x2d, 0x67, 0x72, 0x69, 0x64,
    0xa4, 0x64, 0x61, 0x74, 0x61,
    0x91,
    0x83,
    0xa2, 0x69, 0x64,
    0xa5, 0x72, 0x6f, 0x77, 0x2d, 0x31,
    0xa6, 0x73, 0x79, 0x6d, 0x62, 0x6f, 0x6c,
    0xa4, 0x41, 0x41, 0x50, 0x4c,
    0xa5, 0x70, 0x72, 0x69, 0x63, 0x65,
    0xcc, 0xb6,
    0xaa, 0x63, 0x6f, 0x6c, 0x75, 0x6d, 0x6e, 0x44, 0x65, 0x66, 0x73,
    0x92,
    0x81,
    0xa4, 0x6e, 0x61, 0x6d, 0x65,
    0xa6, 0x73, 0x79, 0x6d, 0x62, 0x6f, 0x6c,
    0x81,
    0xa4, 0x6e, 0x61, 0x6d, 0x65,
    0xa5, 0x70, 0x72, 0x69, 0x63, 0x65,
    0xad, 0x65, 0x6e, 0x61, 0x62, 0x6c, 0x65, 0x53, 0x6f, 0x72, 0x74, 0x69, 0x6e, 0x67,
    0xc3,
};

static const uint8_t COMMAND_MESSAGE_PACK[] = {
    0x83,
    0xa4, 0x6b, 0x69, 0x6e, 0x64,
    0xa7, 0x73, 0x65, 0x74, 0x53, 0x6f, 0x72, 0x74,
    0xaa, 0x63, 0x6f, 0x6c, 0x75, 0x6d, 0x6e, 0x4e, 0x61, 0x6d, 0x65,
    0xa5, 0x70, 0x72, 0x69, 0x63, 0x65,
    0xa9, 0x64, 0x69, 0x72, 0x65, 0x63, 0x74, 0x69, 0x6f, 0x6e,
    0xa4, 0x64, 0x65, 0x73, 0x63,
};

static const uint8_t ROWS_MESSAGE_PACK[] = {
    0x92,
    0x83,
    0xa2, 0x69, 0x64,
    0xa5, 0x72, 0x6f, 0x77, 0x2d, 0x31,
    0xa6, 0x73, 0x79, 0x6d, 0x62, 0x6f, 0x6c,
    0xa4, 0x41, 0x41, 0x50, 0x4c,
    0xa5, 0x70, 0x72, 0x69, 0x63, 0x65,
    0xcc, 0xb7,
    0x83,
    0xa2, 0x69, 0x64,
    0xa5, 0x72, 0x6f, 0x77, 0x2d, 0x32,
    0xa6, 0x73, 0x79, 0x6d, 0x62, 0x6f, 0x6c,
    0xa4, 0x4d, 0x53, 0x46, 0x54,
    0xa5, 0x70, 0x72, 0x69, 0x63, 0x65,
    0xcd, 0x01, 0xa5,
};

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

    if (!ui_grid_engine_set_options_bytes(
            engine,
            UI_GRID_CODEC_MESSAGE_PACK,
            OPTIONS_MESSAGE_PACK,
            sizeof(OPTIONS_MESSAGE_PACK))) {
        int code = fail_with_last_error(engine, "set_options_bytes");
        ui_grid_engine_destroy(engine);
        return code;
    }

    if (!ui_grid_engine_apply_command_bytes(
            engine,
            UI_GRID_CODEC_MESSAGE_PACK,
            COMMAND_MESSAGE_PACK,
            sizeof(COMMAND_MESSAGE_PACK))) {
        int code = fail_with_last_error(engine, "apply_command_bytes");
        ui_grid_engine_destroy(engine);
        return code;
    }

    size_t projection_len = 0;
    uint8_t *projection = ui_grid_engine_get_projection_bytes(
        engine,
        UI_GRID_CODEC_MESSAGE_PACK,
        &projection_len);
    if (projection == NULL) {
        int code = fail_with_last_error(engine, "get_projection_bytes");
        ui_grid_engine_destroy(engine);
        return code;
    }
    printf("messagePackProjectionBytes: %zu\n", projection_len);
    ui_grid_buffer_free(projection, projection_len);

    size_t state_len = 0;
    uint8_t *saved_state = ui_grid_engine_save_state_bytes(
        engine,
        UI_GRID_CODEC_MESSAGE_PACK,
        &state_len);
    if (saved_state == NULL) {
        int code = fail_with_last_error(engine, "save_state_bytes");
        ui_grid_engine_destroy(engine);
        return code;
    }
    printf("messagePackStateBytes: %zu\n", state_len);
    if (!ui_grid_engine_restore_state_bytes(
            engine,
            UI_GRID_CODEC_MESSAGE_PACK,
            saved_state,
            state_len)) {
        ui_grid_buffer_free(saved_state, state_len);
        int code = fail_with_last_error(engine, "restore_state_bytes");
        ui_grid_engine_destroy(engine);
        return code;
    }
    ui_grid_buffer_free(saved_state, state_len);

    if (!ui_grid_engine_set_rows_bytes(
            engine,
            UI_GRID_CODEC_MESSAGE_PACK,
            ROWS_MESSAGE_PACK,
            sizeof(ROWS_MESSAGE_PACK))) {
        int code = fail_with_last_error(engine, "set_rows_bytes");
        ui_grid_engine_destroy(engine);
        return code;
    }

    projection_len = 0;
    projection = ui_grid_engine_get_projection_bytes(
        engine,
        UI_GRID_CODEC_MESSAGE_PACK,
        &projection_len);
    if (projection == NULL) {
        int code = fail_with_last_error(engine, "get_projection_bytes_after_rows");
        ui_grid_engine_destroy(engine);
        return code;
    }
    printf("messagePackProjectionAfterRowsBytes: %zu\n", projection_len);
    ui_grid_buffer_free(projection, projection_len);

    ui_grid_engine_destroy(engine);
    return 0;
}