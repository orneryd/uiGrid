#ifndef UI_GRID_C_ABI_H
#define UI_GRID_C_ABI_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct UiGridAbiEngine UiGridAbiEngine;

typedef enum UiGridAbiCodec {
	UI_GRID_CODEC_JSON = 1,
	UI_GRID_CODEC_MESSAGE_PACK = 2
} UiGridAbiCodec;

char *ui_grid_abi_version(void);
char *ui_grid_projection_schema_version(void);
char *ui_grid_command_schema_version(void);

UiGridAbiEngine *ui_grid_engine_create(void);
void ui_grid_engine_destroy(UiGridAbiEngine *engine);

bool ui_grid_engine_set_options_json(UiGridAbiEngine *engine, const char *options_json);
bool ui_grid_engine_set_options_bytes(UiGridAbiEngine *engine, uint32_t codec, const uint8_t *options_bytes, size_t options_len);
bool ui_grid_engine_set_rows_json(UiGridAbiEngine *engine, const char *rows_json);
bool ui_grid_engine_set_rows_bytes(UiGridAbiEngine *engine, uint32_t codec, const uint8_t *rows_bytes, size_t rows_len);
bool ui_grid_engine_apply_command_json(UiGridAbiEngine *engine, const char *command_json);
bool ui_grid_engine_apply_command_bytes(UiGridAbiEngine *engine, uint32_t codec, const uint8_t *command_bytes, size_t command_len);
char *ui_grid_engine_get_projection_json(UiGridAbiEngine *engine);
uint8_t *ui_grid_engine_get_projection_bytes(UiGridAbiEngine *engine, uint32_t codec, size_t *out_len);
char *ui_grid_engine_save_state_json(UiGridAbiEngine *engine);
uint8_t *ui_grid_engine_save_state_bytes(UiGridAbiEngine *engine, uint32_t codec, size_t *out_len);
bool ui_grid_engine_restore_state_json(UiGridAbiEngine *engine, const char *state_json);
bool ui_grid_engine_restore_state_bytes(UiGridAbiEngine *engine, uint32_t codec, const uint8_t *state_bytes, size_t state_len);
char *ui_grid_engine_last_error_message(UiGridAbiEngine *engine);
void ui_grid_string_free(char *value);
void ui_grid_buffer_free(uint8_t *value, size_t len);

#ifdef __cplusplus
}
#endif

#endif