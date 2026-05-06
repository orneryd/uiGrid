#ifndef UI_GRID_LVGL_THEME_H
#define UI_GRID_LVGL_THEME_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct ui_grid_lvgl_theme {
    uint32_t border_color;
    uint32_t header_background;
    uint32_t pinned_header_background;
    uint32_t row_odd;
    uint32_t row_even;
    uint32_t row_hover;
    uint32_t pinned_row_background;
    uint32_t cell_color;
    uint32_t muted_color;
    uint32_t surface;
    uint32_t accent;
    uint32_t pinned_indicator;
    uint32_t control_hover_background;
    uint32_t control_active_background;
    uint32_t group_background;
    float radius;
    float header_weight;
    float cell_padding_y;
    float cell_padding_x;
    float header_padding_y;
    float header_padding_x;
    float filter_padding_y;
    float group_padding_y;
    float group_indent_per_depth;
    float tree_indent_per_level;
    float row_height;
} ui_grid_lvgl_theme_t;

typedef enum ui_grid_lvgl_theme_preset {
    UI_GRID_LVGL_THEME_DEFAULT_DARK = 0,
    UI_GRID_LVGL_THEME_DEFAULT_LIGHT = 1,
    UI_GRID_LVGL_THEME_WIREFRAME_DARK = 2,
    UI_GRID_LVGL_THEME_WIREFRAME_LIGHT = 3,
} ui_grid_lvgl_theme_preset_t;

ui_grid_lvgl_theme_t ui_grid_lvgl_theme_default_dark(void);
ui_grid_lvgl_theme_t ui_grid_lvgl_theme_default_light(void);
ui_grid_lvgl_theme_t ui_grid_lvgl_theme_wireframe_dark(void);
ui_grid_lvgl_theme_t ui_grid_lvgl_theme_wireframe_light(void);
ui_grid_lvgl_theme_t ui_grid_lvgl_theme_from_preset(ui_grid_lvgl_theme_preset_t preset);
const char *ui_grid_lvgl_theme_preset_label(ui_grid_lvgl_theme_preset_t preset);

#ifdef __cplusplus
}
#endif

#endif