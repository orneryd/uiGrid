#ifndef UI_GRID_LVGL_H
#define UI_GRID_LVGL_H

#include <stdbool.h>

#include <lvgl.h>

#include "ui_grid_c_abi.h"
#include "ui_grid_lvgl_column_ext.h"
#include "ui_grid_lvgl_theme.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct ui_grid_lvgl_adapter ui_grid_lvgl_adapter_t;

typedef enum ui_grid_lvgl_sort_direction {
    UI_GRID_LVGL_SORT_NONE = 0,
    UI_GRID_LVGL_SORT_ASC = 1,
    UI_GRID_LVGL_SORT_DESC = 2
} ui_grid_lvgl_sort_direction_t;

typedef struct ui_grid_lvgl_adapter_config {
    unsigned int row_height;
    bool enable_column_resizing;
    bool use_message_pack;
    const ui_grid_lvgl_theme_t *theme;
    const ui_grid_lvgl_column_ext_t *column_exts;
    size_t column_ext_count;
} ui_grid_lvgl_adapter_config_t;

ui_grid_lvgl_adapter_t *ui_grid_lvgl_create(
    lv_obj_t *parent,
    const ui_grid_lvgl_adapter_config_t *config
);

void ui_grid_lvgl_destroy(ui_grid_lvgl_adapter_t *adapter);

lv_obj_t *ui_grid_lvgl_root(ui_grid_lvgl_adapter_t *adapter);

void ui_grid_lvgl_scroll_table_by(ui_grid_lvgl_adapter_t *adapter, int dx, int dy);

bool ui_grid_lvgl_set_options_json(ui_grid_lvgl_adapter_t *adapter, const char *options_json);
bool ui_grid_lvgl_set_options_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    const unsigned char *options_bytes,
    size_t options_len
);
bool ui_grid_lvgl_set_rows_json(ui_grid_lvgl_adapter_t *adapter, const char *rows_json);
bool ui_grid_lvgl_set_rows_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    const unsigned char *rows_bytes,
    size_t rows_len
);
bool ui_grid_lvgl_apply_command_json(ui_grid_lvgl_adapter_t *adapter, const char *command_json);
bool ui_grid_lvgl_apply_command_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    const unsigned char *command_bytes,
    size_t command_len
);
char *ui_grid_lvgl_save_state_json(ui_grid_lvgl_adapter_t *adapter);
unsigned char *ui_grid_lvgl_save_state_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    size_t *out_len
);
bool ui_grid_lvgl_restore_state_json(ui_grid_lvgl_adapter_t *adapter, const char *state_json);
bool ui_grid_lvgl_restore_state_bytes(
    ui_grid_lvgl_adapter_t *adapter,
    UiGridAbiCodec codec,
    const unsigned char *state_bytes,
    size_t state_len
);

bool ui_grid_lvgl_sort_by(
    ui_grid_lvgl_adapter_t *adapter,
    const char *column_name,
    ui_grid_lvgl_sort_direction_t direction
);
bool ui_grid_lvgl_move_column_before(
    ui_grid_lvgl_adapter_t *adapter,
    const char *column_name,
    const char *target_column_name
);

bool ui_grid_lvgl_refresh(ui_grid_lvgl_adapter_t *adapter);
void ui_grid_lvgl_set_theme(ui_grid_lvgl_adapter_t *adapter, const ui_grid_lvgl_theme_t *theme);

const char *ui_grid_lvgl_last_error(const ui_grid_lvgl_adapter_t *adapter);

#ifdef __cplusplus
}
#endif

#endif