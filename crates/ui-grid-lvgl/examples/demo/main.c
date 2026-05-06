#define SDL_MAIN_HANDLED

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <SDL2/SDL.h>
#include <lvgl.h>
#include <src/drivers/sdl/lv_sdl_keyboard.h>
#include <src/drivers/sdl/lv_sdl_mouse.h>
#include <src/drivers/sdl/lv_sdl_mousewheel.h>
#include <src/drivers/sdl/lv_sdl_window.h>

#include "ui_grid_lvgl.h"

/* ──────────────────────────────────────────────────────────────────────────
 *  Demo data
 * ──────────────────────────────────────────────────────────────────────── */

typedef struct {
    const char *id;
    const char *symbol;
    const char *exchange;
    const char *sector;
    double base_price;
    double price;
    double bid;
    double ask;
    double change;
    double change_pct;
    double high;
    double low;
    int volume;
    int last_size;
} trading_row_t;

typedef struct {
    unsigned int state;
} trading_rng_t;

typedef enum {
    DATASET_FLAT = 0,
    DATASET_TRADING = 1,
    DATASET_TREE = 2,
} dataset_kind_t;

typedef struct {
    ui_grid_lvgl_adapter_t *adapter;
    lv_obj_t *toolbar_top;
    lv_obj_t *toolbar_mid;
    lv_obj_t *toolbar_bot;
    lv_obj_t *status_label;
    lv_obj_t *theme_dropdown;
    lv_obj_t *dataset_dropdown;
    lv_obj_t *filtering_checkbox;
    lv_obj_t *resizing_checkbox;
    lv_obj_t *grouping_checkbox;
    lv_obj_t *pinning_checkbox;
    lv_obj_t *state_textarea;
    lv_obj_t *filter_textarea;
    dataset_kind_t dataset;
    bool filtering_enabled;
    bool grouping_enabled;
    bool pinning_enabled;
    bool resizing_enabled;
    int current_page;
    trading_rng_t rng;
    trading_row_t rows[8];
    ui_grid_lvgl_theme_preset_t theme_preset;
} demo_context_t;

static volatile int g_quit = 0;

static int demo_sdl_event_watch(void *userdata, SDL_Event *event) {
    if (event == NULL) {
        return 1;
    }
    if (event->type == SDL_QUIT) {
        g_quit = 1;
        return 1;
    }
    if (event->type != SDL_MOUSEWHEEL) {
        return 1;
    }
    demo_context_t *ctx = (demo_context_t *)userdata;
    if (ctx == NULL || ctx->adapter == NULL) {
        return 1;
    }
    /* SDL trackpad/wheel: positive y means content should scroll up.
     * We translate one notch to ~40px to feel like native scrolling. */
    const int step = 40;
    float fx = (float)event->wheel.x;
    float fy = (float)event->wheel.y;
#if SDL_VERSION_ATLEAST(2, 0, 18)
    if (event->wheel.preciseX != 0.0f || event->wheel.preciseY != 0.0f) {
        fx = event->wheel.preciseX;
        fy = event->wheel.preciseY;
    }
#endif
    int dir = (event->wheel.direction == SDL_MOUSEWHEEL_FLIPPED) ? -1 : 1;
    int dx = (int)(fx * (float)step) * dir;
    int dy = (int)(fy * (float)step) * dir;
    if (dx == 0 && dy == 0) {
        return 1;
    }
    ui_grid_lvgl_scroll_table_by(ctx->adapter, dx, dy);
    return 1;
}

static const char *FLAT_OPTIONS_JSON =
    "{"
    "\"id\":\"lvgl-flat\","
    "\"title\":\"Accounts\","
    "\"columnDefs\":["
      "{\"name\":\"account\",\"displayName\":\"Account\"},"
      "{\"name\":\"owner\",\"displayName\":\"Owner\"},"
      "{\"name\":\"status\",\"displayName\":\"Status\"},"
      "{\"name\":\"manager\",\"displayName\":\"Manager\"},"
      "{\"name\":\"region\",\"displayName\":\"Region\"},"
            "{\"name\":\"segment\",\"displayName\":\"Segment\"},"
            "{\"name\":\"tier\",\"displayName\":\"Tier\"},"
            "{\"name\":\"city\",\"displayName\":\"City\"},"
            "{\"name\":\"arr\",\"displayName\":\"ARR\"},"
            "{\"name\":\"renewal\",\"displayName\":\"Renewal\"}"
    "],"
    "\"enableSorting\":true,"
    "\"enableFiltering\":true,"
    "\"enableGrouping\":true,"
    "\"enablePinning\":true,"
    "\"enableColumnMoving\":true,"
    "\"enableColumnResizing\":true"
    "}";

static const char *FLAT_ROWS_JSON =
    "["
            "{\"id\":\"acct-1\",\"account\":\"ACCT-0001\",\"owner\":\"Alice\",\"status\":\"Active\",\"manager\":\"Morgan\",\"region\":\"North America\",\"segment\":\"Enterprise\",\"tier\":\"Gold\",\"city\":\"New York\",\"arr\":\"$182K\",\"renewal\":\"2026-08-14\"},"
            "{\"id\":\"acct-2\",\"account\":\"ACCT-0002\",\"owner\":\"Bob\",\"status\":\"Trial\",\"manager\":\"Jules\",\"region\":\"Europe\",\"segment\":\"Public Sector\",\"tier\":\"Silver\",\"city\":\"Berlin\",\"arr\":\"$74K\",\"renewal\":\"2026-11-03\"},"
            "{\"id\":\"acct-3\",\"account\":\"ACCT-0003\",\"owner\":\"Alicia\",\"status\":\"Active\",\"manager\":\"Riley\",\"region\":\"LATAM\",\"segment\":\"SMB\",\"tier\":\"Bronze\",\"city\":\"Sao Paulo\",\"arr\":\"$28K\",\"renewal\":\"2027-01-19\"},"
            "{\"id\":\"acct-4\",\"account\":\"ACCT-0004\",\"owner\":\"Charlie\",\"status\":\"Churned\",\"manager\":\"Parker\",\"region\":\"APAC\",\"segment\":\"SMB\",\"tier\":\"Silver\",\"city\":\"Singapore\",\"arr\":\"$11K\",\"renewal\":\"2025-12-01\"}"
    "]";

static const char *TRADING_OPTIONS_JSON =
    "{"
    "\"id\":\"lvgl-trading-terminal\","
    "\"title\":\"Trading Terminal\","
    "\"columnDefs\":["
      "{\"name\":\"symbol\",\"displayName\":\"Symbol\"},"
      "{\"name\":\"exchange\",\"displayName\":\"Exchange\"},"
      "{\"name\":\"sector\",\"displayName\":\"Sector\"},"
      "{\"name\":\"price\",\"displayName\":\"Price\"},"
      "{\"name\":\"bid\",\"displayName\":\"Bid\"},"
      "{\"name\":\"ask\",\"displayName\":\"Ask\"},"
      "{\"name\":\"change\",\"displayName\":\"Change\"},"
      "{\"name\":\"changePct\",\"displayName\":\"Change %\"},"
            "{\"name\":\"high\",\"displayName\":\"High\"},"
            "{\"name\":\"low\",\"displayName\":\"Low\"},"
      "{\"name\":\"volume\",\"displayName\":\"Volume\"},"
            "{\"name\":\"lastSize\",\"displayName\":\"Last Size\"},"
            "{\"name\":\"basePrice\",\"displayName\":\"Base\"},"
            "{\"name\":\"spread\",\"displayName\":\"Spread\"}"
    "],"
    "\"enableSorting\":true,"
    "\"enableFiltering\":true,"
    "\"enableGrouping\":true,"
    "\"enablePinning\":true,"
    "\"enableColumnMoving\":true,"
    "\"enableColumnResizing\":true,"
    "\"enableExpandable\":true,"
    "\"enablePagination\":true,"
    "\"paginationPageSize\":6"
    "}";

static const char *TREE_OPTIONS_JSON =
    "{"
    "\"id\":\"lvgl-tree-terminal\","
    "\"title\":\"Trading Tree\","
    "\"columnDefs\":["
      "{\"name\":\"symbol\",\"displayName\":\"Node\"},"
      "{\"name\":\"exchange\",\"displayName\":\"Exchange\"},"
      "{\"name\":\"sector\",\"displayName\":\"Sector\"},"
      "{\"name\":\"price\",\"displayName\":\"Price\"},"
      "{\"name\":\"change\",\"displayName\":\"Change\"}"
    "],"
    "\"enableSorting\":true,"
    "\"enableFiltering\":true,"
    "\"enablePinning\":true,"
    "\"enableColumnMoving\":true,"
    "\"enableColumnResizing\":true,"
    "\"enableTreeView\":true,"
    "\"treeChildrenField\":\"children\""
    "}";

static const char *TREE_ROWS_JSON =
    "["
      "{\"id\":\"desk-nyse\",\"symbol\":\"NYSE Desk\",\"exchange\":\"NYSE\",\"sector\":\"Desk\",\"price\":0,\"change\":0,\"children\":["
        "{\"id\":\"desk-nyse-jpm\",\"symbol\":\"JPM\",\"exchange\":\"NYSE\",\"sector\":\"Financial\",\"price\":215.00,\"change\":1.12},"
        "{\"id\":\"desk-nyse-gs\",\"symbol\":\"GS\",\"exchange\":\"NYSE\",\"sector\":\"Financial\",\"price\":480.00,\"change\":-0.61}"
      "]},"
      "{\"id\":\"desk-nasdaq\",\"symbol\":\"NASDAQ Desk\",\"exchange\":\"NASDAQ\",\"sector\":\"Desk\",\"price\":0,\"change\":0,\"children\":["
        "{\"id\":\"desk-nasdaq-nvda\",\"symbol\":\"NVDA\",\"exchange\":\"NASDAQ\",\"sector\":\"Technology\",\"price\":948.72,\"change\":8.10},"
        "{\"id\":\"desk-nasdaq-msft\",\"symbol\":\"MSFT\",\"exchange\":\"NASDAQ\",\"sector\":\"Technology\",\"price\":421.30,\"change\":-0.56}"
      "]}"
    "]";

static unsigned int trading_rng_next(trading_rng_t *rng) {
    rng->state = rng->state * 1664525u + 1013904223u;
    return rng->state;
}

static double trading_rng_f64(trading_rng_t *rng) {
    return (double)trading_rng_next(rng) / 4294967296.0;
}

static double trading_rng_range(trading_rng_t *rng, double lo, double hi) {
    return lo + trading_rng_f64(rng) * (hi - lo);
}

static void init_trading_rows(demo_context_t *context) {
    const trading_row_t seed_rows[8] = {
        {"trade-0", "NVDA", "NASDAQ", "Technology", 948.72, 948.72, 948.50, 948.94, 8.10, 0.86, 952.10, 939.40, 498000, 220},
        {"trade-1", "MSFT", "NASDAQ", "Technology", 421.30, 421.30, 421.10, 421.45, -0.56, -0.13, 423.80, 418.20, 412000, 180},
        {"trade-2", "AAPL", "NASDAQ", "Technology", 182.15, 182.15, 182.08, 182.24, 1.24, 0.69, 183.00, 179.40, 610000, 140},
        {"trade-3", "TSLA", "NASDAQ", "Automotive", 176.44, 176.44, 176.30, 176.58, -2.18, -1.22, 181.10, 175.90, 720000, 90},
        {"trade-4", "JPM", "NYSE", "Financial", 215.00, 215.00, 214.92, 215.12, 0.88, 0.41, 216.60, 212.10, 302000, 120},
        {"trade-5", "GS", "NYSE", "Financial", 480.00, 480.00, 479.70, 480.30, -0.61, -0.13, 482.40, 477.90, 188000, 75},
        {"trade-6", "XOM", "NYSE", "Energy", 115.00, 115.00, 114.96, 115.08, 0.33, 0.29, 116.20, 113.80, 264000, 240},
        {"trade-7", "ETH-USD", "CRYPTO", "Crypto", 3400.00, 3400.00, 3399.20, 3400.80, 25.40, 0.75, 3430.00, 3345.00, 95000, 40},
    };

    memcpy(context->rows, seed_rows, sizeof(seed_rows));
    context->rng.state = 0xdeadbeefu;
}

static char *build_trading_rows_json(const demo_context_t *context) {
    size_t capacity = 8192;
    char *json = (char *)malloc(capacity);
    size_t cursor = 0;

    if (json == NULL) {
        return NULL;
    }

    cursor += (size_t)snprintf(json + cursor, capacity - cursor, "[");
    for (size_t index = 0; index < 8; index++) {
        const trading_row_t *row = &context->rows[index];
        double spread = row->ask - row->bid;
        cursor += (size_t)snprintf(
            json + cursor,
            capacity - cursor,
            "%s{\"id\":\"%s\",\"symbol\":\"%s\",\"exchange\":\"%s\",\"sector\":\"%s\",\"price\":%.2f,\"bid\":%.2f,\"ask\":%.2f,\"change\":%.2f,\"changePct\":%.2f,\"high\":%.2f,\"low\":%.2f,\"volume\":%d,\"lastSize\":%d,\"basePrice\":%.2f,\"spread\":%.2f}",
            index == 0 ? "" : ",",
            row->id,
            row->symbol,
            row->exchange,
            row->sector,
            row->price,
            row->bid,
            row->ask,
            row->change,
            row->change_pct,
            row->high,
            row->low,
            row->volume,
            row->last_size,
            row->base_price,
            spread
        );
    }
    snprintf(json + cursor, capacity - cursor, "]");
    return json;
}

static void tick_trading_rows(demo_context_t *context) {
    for (size_t index = 0; index < 8; index++) {
        trading_row_t *row = &context->rows[index];
        double delta = trading_rng_range(&context->rng, -0.0015, 0.0015);
        if (trading_rng_f64(&context->rng) < 0.03) {
            delta += trading_rng_range(&context->rng, -0.005, 0.005);
        }

        row->price = fmax(row->price * (1.0 + delta), 0.01);
        row->bid = row->price - fmax(row->price * 0.0002, 0.01);
        row->ask = row->price + fmax(row->price * 0.0002, 0.01);
        row->high = fmax(row->high, row->price);
        row->low = fmin(row->low, row->price);
        row->change = row->price - row->base_price;
        row->change_pct = row->base_price != 0.0 ? (row->change / row->base_price) * 100.0 : 0.0;
        row->volume += (int)trading_rng_range(&context->rng, 100.0, 5000.0);
        row->last_size = (int)trading_rng_range(&context->rng, 1.0, 400.0);
    }
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Helpers
 * ──────────────────────────────────────────────────────────────────────── */

static void set_status(demo_context_t *context, const char *message) {
    if (context->status_label == NULL) {
        return;
    }
    lv_label_set_text(context->status_label, message);
}

static char *replace_json_bool_flag(const char *source, const char *flag_name, bool enabled) {
    char needle[96];
    char replacement[96];
    const char *found;
    size_t prefix_len;
    size_t suffix_len;
    size_t replacement_len;
    char *result;

    snprintf(needle, sizeof(needle), "\"%s\":true", flag_name);
    snprintf(replacement, sizeof(replacement), "\"%s\":%s", flag_name, enabled ? "true" : "false");

    found = strstr(source, needle);
    if (found == NULL) {
        size_t len = strlen(source);
        char *copy = (char *)malloc(len + 1);
        if (copy == NULL) {
            return NULL;
        }
        memcpy(copy, source, len + 1);
        return copy;
    }

    prefix_len = (size_t)(found - source);
    suffix_len = strlen(found + strlen(needle));
    replacement_len = strlen(replacement);
    result = (char *)malloc(prefix_len + replacement_len + suffix_len + 1);
    if (result == NULL) {
        return NULL;
    }

    memcpy(result, source, prefix_len);
    memcpy(result + prefix_len, replacement, replacement_len);
    memcpy(result + prefix_len + replacement_len, found + strlen(needle), suffix_len + 1);
    return result;
}

static char *build_options_json_for_dataset(dataset_kind_t kind, bool filtering_enabled, bool resizing_enabled) {
    const char *template_json = FLAT_OPTIONS_JSON;
    char *with_filtering;
    char *result;

    switch (kind) {
        case DATASET_FLAT:
            template_json = FLAT_OPTIONS_JSON;
            break;
        case DATASET_TRADING:
            template_json = TRADING_OPTIONS_JSON;
            break;
        case DATASET_TREE:
            template_json = TREE_OPTIONS_JSON;
            break;
    }

    with_filtering = replace_json_bool_flag(template_json, "enableFiltering", filtering_enabled);
    if (with_filtering == NULL) {
        return NULL;
    }

    result = replace_json_bool_flag(with_filtering, "enableColumnResizing", resizing_enabled);
    free(with_filtering);
    if (result == NULL) {
        return NULL;
    }

    return result;
}

static bool apply_command(demo_context_t *context, const char *command_json, const char *success_message) {
    if (!ui_grid_lvgl_apply_command_json(context->adapter, command_json)) {
        set_status(context, ui_grid_lvgl_last_error(context->adapter));
        return false;
    }
    set_status(context, success_message);
    return true;
}

static bool load_dataset(demo_context_t *context, dataset_kind_t kind) {
    char *options_json;
    char *rows_json;
    context->dataset = kind;
    context->current_page = 1;
    options_json = build_options_json_for_dataset(kind, context->filtering_enabled, context->resizing_enabled);
    if (options_json == NULL) {
        set_status(context, "failed to allocate options JSON");
        return false;
    }

    switch (kind) {
        case DATASET_FLAT:
            if (!ui_grid_lvgl_set_options_json(context->adapter, options_json)) {
                free(options_json);
                set_status(context, ui_grid_lvgl_last_error(context->adapter));
                return false;
            }
            if (!ui_grid_lvgl_set_rows_json(context->adapter, FLAT_ROWS_JSON)) {
                free(options_json);
                set_status(context, ui_grid_lvgl_last_error(context->adapter));
                return false;
            }
            free(options_json);
            set_status(context, "Loaded flat (4 rows)");
            return true;
        case DATASET_TRADING:
            if (!ui_grid_lvgl_set_options_json(context->adapter, options_json)) {
                free(options_json);
                set_status(context, ui_grid_lvgl_last_error(context->adapter));
                return false;
            }
            rows_json = build_trading_rows_json(context);
            if (rows_json == NULL) {
                free(options_json);
                set_status(context, "failed to allocate trading rows JSON");
                return false;
            }
            if (!ui_grid_lvgl_set_rows_json(context->adapter, rows_json)) {
                free(rows_json);
                free(options_json);
                set_status(context, ui_grid_lvgl_last_error(context->adapter));
                return false;
            }
            free(rows_json);
            free(options_json);
            set_status(context, "Loaded trading terminal (8 rows)");
            return true;
        case DATASET_TREE:
            if (!ui_grid_lvgl_set_options_json(context->adapter, options_json)) {
                free(options_json);
                set_status(context, ui_grid_lvgl_last_error(context->adapter));
                return false;
            }
            if (!ui_grid_lvgl_set_rows_json(context->adapter, TREE_ROWS_JSON)) {
                free(options_json);
                set_status(context, ui_grid_lvgl_last_error(context->adapter));
                return false;
            }
            free(options_json);
            set_status(context, "Loaded tree dataset");
            return true;
    }
    free(options_json);
    return false;
}

static void apply_demo_theme(demo_context_t *context, const ui_grid_lvgl_theme_t *theme);

/* ──────────────────────────────────────────────────────────────────────────
 *  Event handlers
 * ──────────────────────────────────────────────────────────────────────── */

static void on_dataset_changed(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    uint32_t selected = lv_dropdown_get_selected(context->dataset_dropdown);
    load_dataset(context, (dataset_kind_t)selected);
}

static void on_theme_changed(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    uint32_t selected = lv_dropdown_get_selected(context->theme_dropdown);
    ui_grid_lvgl_theme_t theme = ui_grid_lvgl_theme_from_preset((ui_grid_lvgl_theme_preset_t)selected);
    context->theme_preset = (ui_grid_lvgl_theme_preset_t)selected;
    ui_grid_lvgl_set_theme(context->adapter, &theme);
    apply_demo_theme(context, &theme);
    set_status(context, ui_grid_lvgl_theme_preset_label(context->theme_preset));
}

static void on_grouping_toggle(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    bool checked = lv_obj_has_state(context->grouping_checkbox, LV_STATE_CHECKED);
    context->grouping_enabled = checked;
    apply_command(
        context,
        checked
            ? "{\"kind\":\"setGrouping\",\"groupBy\":[\"sector\"]}"
            : "{\"kind\":\"setGrouping\",\"groupBy\":[]}",
        checked ? "Grouped by sector" : "Grouping cleared"
    );
}

static void on_pinning_toggle(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    bool checked = lv_obj_has_state(context->pinning_checkbox, LV_STATE_CHECKED);
    const char *col = context->dataset == DATASET_FLAT ? "account" : "symbol";
    char command[256];
    context->pinning_enabled = checked;
    if (checked) {
        snprintf(command, sizeof(command),
            "{\"kind\":\"setPinnedColumns\",\"pinnedColumns\":{\"%s\":\"left\"}}", col);
    } else {
        snprintf(command, sizeof(command), "{\"kind\":\"setPinnedColumns\",\"pinnedColumns\":{}}");
    }
    apply_command(context, command, checked ? "Pinned first column left" : "Pinning cleared");
}

static void on_resizing_toggle(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    bool checked = lv_obj_has_state(context->resizing_checkbox, LV_STATE_CHECKED);
    context->resizing_enabled = checked;
    if (load_dataset(context, context->dataset)) {
        set_status(context, checked ? "Column resizing enabled" : "Column resizing disabled");
    }
}

static void on_filtering_toggle(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    bool checked = lv_obj_has_state(context->filtering_checkbox, LV_STATE_CHECKED);
    context->filtering_enabled = checked;
    if (load_dataset(context, context->dataset)) {
        set_status(context, checked ? "Column filtering enabled" : "Column filtering disabled");
    }
}

static void on_apply_filter(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    char command[256];
    const char *term = lv_textarea_get_text(context->filter_textarea);
    const char *col = context->dataset == DATASET_FLAT ? "owner" : "symbol";
    snprintf(command, sizeof(command), "{\"kind\":\"setFilter\",\"columnName\":\"%s\",\"value\":\"%s\"}", col, term);
    apply_command(context, command, "Applied filter");
}

static void on_clear_filter(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    lv_textarea_set_text(context->filter_textarea, "");
    apply_command(context, "{\"kind\":\"clearFilters\"}", "Cleared filters");
}

static void on_save_state(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    char *state_json = ui_grid_lvgl_save_state_json(context->adapter);
    if (state_json == NULL) {
        set_status(context, ui_grid_lvgl_last_error(context->adapter));
        return;
    }
    lv_textarea_set_text(context->state_textarea, state_json);
    ui_grid_string_free(state_json);
    set_status(context, "Saved state");
}

static void on_restore_state(lv_event_t *event) {
    demo_context_t *context = (demo_context_t *)lv_event_get_user_data(event);
    const char *state_json = lv_textarea_get_text(context->state_textarea);
    if (!ui_grid_lvgl_restore_state_json(context->adapter, state_json)) {
        set_status(context, ui_grid_lvgl_last_error(context->adapter));
        return;
    }
    set_status(context, "Restored state");
}

static void on_tick_timer(lv_timer_t *timer) {
    demo_context_t *context = (demo_context_t *)lv_timer_get_user_data(timer);
    char *rows_json;

    if (context->dataset != DATASET_TRADING) {
        return;
    }

    tick_trading_rows(context);
    rows_json = build_trading_rows_json(context);
    if (rows_json == NULL) {
        return;
    }
    ui_grid_lvgl_set_rows_json(context->adapter, rows_json);
    free(rows_json);
}

/* ──────────────────────────────────────────────────────────────────────────
 *  UI construction
 * ──────────────────────────────────────────────────────────────────────── */

static lv_obj_t *create_button(lv_obj_t *parent, const char *text) {
    lv_obj_t *button = lv_button_create(parent);
    lv_obj_t *label = lv_label_create(button);
    lv_label_set_text(label, text);
    lv_obj_center(label);
    lv_obj_set_style_pad_top(button, 6, 0);
    lv_obj_set_style_pad_bottom(button, 6, 0);
    lv_obj_set_style_pad_left(button, 10, 0);
    lv_obj_set_style_pad_right(button, 10, 0);
    return button;
}

static lv_obj_t *create_checkbox(lv_obj_t *parent, const char *text) {
    lv_obj_t *cb = lv_checkbox_create(parent);
    lv_checkbox_set_text(cb, text);
    return cb;
}

static lv_obj_t *create_toolbar(lv_obj_t *parent) {
    lv_obj_t *bar = lv_obj_create(parent);
    lv_obj_set_width(bar, LV_PCT(100));
    lv_obj_set_height(bar, LV_SIZE_CONTENT);
    lv_obj_set_layout(bar, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(bar, LV_FLEX_FLOW_ROW_WRAP);
    lv_obj_set_flex_align(bar, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_all(bar, 6, 0);
    lv_obj_set_style_pad_gap(bar, 8, 0);
    lv_obj_set_style_bg_opa(bar, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(bar, 0, 0);
    lv_obj_remove_flag(bar, LV_OBJ_FLAG_SCROLLABLE);
    return bar;
}

static void style_control_text(lv_obj_t *obj, lv_color_t color) {
    uint32_t child_count;

    if (obj == NULL) {
        return;
    }

    lv_obj_set_style_text_color(obj, color, 0);
    child_count = lv_obj_get_child_count(obj);
    for (uint32_t index = 0; index < child_count; index++) {
        style_control_text(lv_obj_get_child(obj, index), color);
    }
}

static void style_toolbar(lv_obj_t *toolbar, const ui_grid_lvgl_theme_t *theme) {
    if (toolbar == NULL || theme == NULL) {
        return;
    }

    lv_obj_set_style_bg_color(toolbar, lv_color_hex(theme->surface), 0);
    lv_obj_set_style_bg_opa(toolbar, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(toolbar, lv_color_hex(theme->border_color), 0);
    lv_obj_set_style_border_width(toolbar, 1, 0);
    lv_obj_set_style_radius(toolbar, (int32_t)theme->radius, 0);
    style_control_text(toolbar, lv_color_hex(theme->cell_color));
}

static void style_button(lv_obj_t *button, const ui_grid_lvgl_theme_t *theme) {
    if (button == NULL || theme == NULL) {
        return;
    }

    lv_obj_set_style_bg_color(button, lv_color_hex(theme->header_background), 0);
    lv_obj_set_style_bg_opa(button, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(button, lv_color_hex(theme->border_color), 0);
    lv_obj_set_style_border_width(button, 1, 0);
    lv_obj_set_style_radius(button, (int32_t)theme->radius, 0);
    style_control_text(button, lv_color_hex(theme->cell_color));
}

static void style_dropdown(lv_obj_t *dropdown, const ui_grid_lvgl_theme_t *theme) {
    if (dropdown == NULL || theme == NULL) {
        return;
    }

    lv_obj_set_style_bg_color(dropdown, lv_color_hex(theme->header_background), 0);
    lv_obj_set_style_bg_opa(dropdown, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(dropdown, lv_color_hex(theme->border_color), 0);
    lv_obj_set_style_border_width(dropdown, 1, 0);
    lv_obj_set_style_radius(dropdown, (int32_t)theme->radius, 0);
    lv_obj_set_style_text_color(dropdown, lv_color_hex(theme->cell_color), 0);
    lv_obj_set_style_text_color(dropdown, lv_color_hex(theme->cell_color), LV_PART_INDICATOR);
}

static void style_checkbox(lv_obj_t *checkbox, const ui_grid_lvgl_theme_t *theme) {
    if (checkbox == NULL || theme == NULL) {
        return;
    }

    lv_obj_set_style_text_color(checkbox, lv_color_hex(theme->cell_color), 0);
    lv_obj_set_style_bg_color(checkbox, lv_color_hex(theme->surface), LV_PART_INDICATOR);
    lv_obj_set_style_bg_opa(checkbox, LV_OPA_COVER, LV_PART_INDICATOR);
    lv_obj_set_style_border_color(checkbox, lv_color_hex(theme->border_color), LV_PART_INDICATOR);
    lv_obj_set_style_border_width(checkbox, 1, LV_PART_INDICATOR);
    lv_obj_set_style_bg_color(checkbox, lv_color_hex(theme->accent), LV_PART_INDICATOR | LV_STATE_CHECKED);
    lv_obj_set_style_border_color(checkbox, lv_color_hex(theme->accent), LV_PART_INDICATOR | LV_STATE_CHECKED);
}

static void style_textarea(lv_obj_t *textarea, const ui_grid_lvgl_theme_t *theme) {
    if (textarea == NULL || theme == NULL) {
        return;
    }

    lv_obj_set_style_bg_color(textarea, lv_color_hex(theme->header_background), 0);
    lv_obj_set_style_bg_opa(textarea, LV_OPA_COVER, 0);
    lv_obj_set_style_border_color(textarea, lv_color_hex(theme->border_color), 0);
    lv_obj_set_style_border_width(textarea, 1, 0);
    lv_obj_set_style_radius(textarea, (int32_t)theme->radius, 0);
    lv_obj_set_style_text_color(textarea, lv_color_hex(theme->cell_color), 0);
}

static void apply_demo_theme(demo_context_t *context, const ui_grid_lvgl_theme_t *theme) {
    uint32_t child_count;

    if (context == NULL || theme == NULL) {
        return;
    }

    style_toolbar(context->toolbar_top, theme);
    style_toolbar(context->toolbar_mid, theme);
    style_toolbar(context->toolbar_bot, theme);
    style_dropdown(context->dataset_dropdown, theme);
    style_dropdown(context->theme_dropdown, theme);
    style_checkbox(context->filtering_checkbox, theme);
    style_checkbox(context->grouping_checkbox, theme);
    style_checkbox(context->pinning_checkbox, theme);
    style_checkbox(context->resizing_checkbox, theme);
    style_textarea(context->filter_textarea, theme);
    style_textarea(context->state_textarea, theme);

    if (context->toolbar_mid != NULL) {
        child_count = lv_obj_get_child_count(context->toolbar_mid);
        for (uint32_t index = 0; index < child_count; index++) {
            lv_obj_t *child = lv_obj_get_child(context->toolbar_mid, index);
            if (child != context->theme_dropdown && child != context->filter_textarea) {
                style_button(child, theme);
            }
        }
    }

    if (context->status_label != NULL) {
        lv_obj_set_style_text_color(context->status_label, lv_color_hex(theme->muted_color), 0);
    }
}

int main(void) {
    lv_display_t *display;
    lv_indev_t *mouse;
    lv_indev_t *mouse_wheel;
    lv_indev_t *keyboard;
    lv_obj_t *screen;
    lv_obj_t *toolbar_top;
    lv_obj_t *toolbar_mid;
    lv_obj_t *toolbar_bot;
    lv_obj_t *grid_container;
    ui_grid_lvgl_adapter_t *adapter;
    demo_context_t context = {0};
    ui_grid_lvgl_theme_t initial_theme = ui_grid_lvgl_theme_default_dark();
    ui_grid_lvgl_adapter_config_t config = {
        .row_height = 44,
        .enable_column_resizing = true,
        .use_message_pack = false,
        .theme = &initial_theme,
    };

    lv_init();

    display = lv_sdl_window_create(1180, 760);
    mouse = lv_sdl_mouse_create();
    mouse_wheel = lv_sdl_mousewheel_create();
    keyboard = lv_sdl_keyboard_create();
    (void)display;
    (void)mouse;
    (void)mouse_wheel;

    lv_group_set_default(lv_group_create());
    lv_indev_set_group(keyboard, lv_group_get_default());

    screen = lv_screen_active();
    lv_obj_set_layout(screen, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(screen, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_all(screen, 8, 0);
    lv_obj_set_style_pad_gap(screen, 4, 0);
    lv_obj_set_style_bg_color(screen, lv_color_hex(0x0b1824), 0);

    /* Top toolbar: Dataset + grid feature checkboxes */
    toolbar_top = create_toolbar(screen);
    context.toolbar_top = toolbar_top;
    {
        lv_obj_t *label = lv_label_create(toolbar_top);
        lv_label_set_text(label, "Dataset:");
    }
    context.dataset_dropdown = lv_dropdown_create(toolbar_top);
    lv_dropdown_set_options(context.dataset_dropdown, "Flat (4 rows)\nTrading (8 rows)\nTree");
    lv_obj_set_width(context.dataset_dropdown, 180);

    context.filtering_checkbox = create_checkbox(toolbar_top, "Filtering");
    context.grouping_checkbox = create_checkbox(toolbar_top, "Group");
    context.pinning_checkbox = create_checkbox(toolbar_top, "Pinning");
    context.resizing_checkbox = create_checkbox(toolbar_top, "Column resizing");
    lv_obj_add_state(context.filtering_checkbox, LV_STATE_CHECKED);
    lv_obj_add_state(context.resizing_checkbox, LV_STATE_CHECKED);

    /* Mid toolbar: Theme + Save/Restore + Filter */
    toolbar_mid = create_toolbar(screen);
    context.toolbar_mid = toolbar_mid;
    {
        lv_obj_t *label = lv_label_create(toolbar_mid);
        lv_label_set_text(label, "Theme:");
    }
    context.theme_dropdown = lv_dropdown_create(toolbar_mid);
    lv_dropdown_set_options(context.theme_dropdown, "Dark\nLight\nWireframe Dark\nWireframe Light");
    lv_dropdown_set_selected(context.theme_dropdown, 0);
    lv_obj_set_width(context.theme_dropdown, 180);

    {
        lv_obj_t *save_btn = create_button(toolbar_mid, "Save state");
        lv_obj_t *restore_btn = create_button(toolbar_mid, "Restore state");
        lv_obj_add_event_cb(save_btn, on_save_state, LV_EVENT_CLICKED, &context);
        lv_obj_add_event_cb(restore_btn, on_restore_state, LV_EVENT_CLICKED, &context);
    }

    context.filter_textarea = lv_textarea_create(toolbar_mid);
    lv_obj_set_width(context.filter_textarea, 180);
    lv_obj_set_height(context.filter_textarea, 36);
    lv_textarea_set_one_line(context.filter_textarea, true);
    lv_textarea_set_placeholder_text(context.filter_textarea, "Filter…");
    {
        lv_obj_t *apply_btn = create_button(toolbar_mid, "Apply filter");
        lv_obj_t *clear_btn = create_button(toolbar_mid, "Clear filters");
        lv_obj_add_event_cb(apply_btn, on_apply_filter, LV_EVENT_CLICKED, &context);
        lv_obj_add_event_cb(clear_btn, on_clear_filter, LV_EVENT_CLICKED, &context);
    }

    /* Bottom toolbar: status + saved-state textarea */
    toolbar_bot = create_toolbar(screen);
    context.toolbar_bot = toolbar_bot;
    context.status_label = lv_label_create(toolbar_bot);
    lv_label_set_text(context.status_label, "Loading…");
    lv_obj_set_style_text_color(context.status_label, lv_color_hex(0x89a1b2), 0);

    context.state_textarea = lv_textarea_create(toolbar_bot);
    lv_obj_set_width(context.state_textarea, 320);
    lv_obj_set_height(context.state_textarea, 36);
    lv_textarea_set_one_line(context.state_textarea, true);
    lv_textarea_set_placeholder_text(context.state_textarea, "Saved state JSON appears here");

    /* Grid panel: fills remaining vertical space */
    grid_container = lv_obj_create(screen);
    lv_obj_set_width(grid_container, LV_PCT(100));
    lv_obj_set_flex_grow(grid_container, 1);
    lv_obj_set_layout(grid_container, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(grid_container, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_all(grid_container, 0, 0);
    lv_obj_set_style_bg_opa(grid_container, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(grid_container, 0, 0);
    lv_obj_remove_flag(grid_container, LV_OBJ_FLAG_SCROLLABLE);

    adapter = ui_grid_lvgl_create(grid_container, &config);
    if (adapter == NULL) {
        fprintf(stderr, "failed to create LVGL adapter\n");
        return 1;
    }
    lv_obj_set_flex_grow(ui_grid_lvgl_root(adapter), 1);

    context.adapter = adapter;
    context.dataset = DATASET_FLAT;
    context.filtering_enabled = true;
    context.grouping_enabled = false;
    context.pinning_enabled = false;
    context.resizing_enabled = true;
    context.current_page = 1;
    context.theme_preset = UI_GRID_LVGL_THEME_DEFAULT_DARK;
    init_trading_rows(&context);
    apply_demo_theme(&context, &initial_theme);

    SDL_AddEventWatch(demo_sdl_event_watch, &context);

    lv_obj_add_event_cb(context.dataset_dropdown, on_dataset_changed, LV_EVENT_VALUE_CHANGED, &context);
    lv_obj_add_event_cb(context.theme_dropdown, on_theme_changed, LV_EVENT_VALUE_CHANGED, &context);
    lv_obj_add_event_cb(context.filtering_checkbox, on_filtering_toggle, LV_EVENT_VALUE_CHANGED, &context);
    lv_obj_add_event_cb(context.grouping_checkbox, on_grouping_toggle, LV_EVENT_VALUE_CHANGED, &context);
    lv_obj_add_event_cb(context.pinning_checkbox, on_pinning_toggle, LV_EVENT_VALUE_CHANGED, &context);
    lv_obj_add_event_cb(context.resizing_checkbox, on_resizing_toggle, LV_EVENT_VALUE_CHANGED, &context);

    if (!load_dataset(&context, DATASET_FLAT)) {
        fprintf(stderr, "failed to load initial dataset: %s\n", ui_grid_lvgl_last_error(adapter));
        ui_grid_lvgl_destroy(adapter);
        return 1;
    }

    lv_timer_create(on_tick_timer, 250, &context);

    for (;;) {
        if (g_quit) {
            SDL_DelEventWatch(demo_sdl_event_watch, &context);
            ui_grid_lvgl_destroy(adapter);
            lv_deinit();
            SDL_Quit();
            return 0;
        }
        uint32_t delay_ms = lv_timer_handler();
        if (delay_ms == LV_NO_TIMER_READY) {
            delay_ms = LV_DEF_REFR_PERIOD;
        }
        lv_delay_ms(delay_ms);
    }
}
