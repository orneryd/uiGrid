use serde::de::DeserializeOwned;
use wasm_bindgen::prelude::*;

use ui_grid_core::{
    export::export_csv_rows,
    models::{BuildGridPipelineContext, GridColumnDef, GridRow},
    pipeline::build_grid_pipeline,
    state::{BuildGridSavedStateContext, build_grid_saved_state, normalize_grid_saved_state},
};
use ui_grid_virtualization::{VirtualWindowRequest, calculate_virtual_window};

fn from_js<T: DeserializeOwned>(value: JsValue) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&format!("failed to decode wasm input: {error}")))
}

fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    value
        .serialize(&serializer)
        .map_err(|error| JsValue::from_str(&format!("failed to encode wasm output: {error}")))
}

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[wasm_bindgen]
pub fn build_pipeline_js(context: JsValue) -> Result<JsValue, JsValue> {
    let context: BuildGridPipelineContext = from_js(context)?;
    let result = build_grid_pipeline(&context);
    to_js(&result)
}

#[wasm_bindgen]
pub fn export_csv_rows_js(columns: JsValue, rows: JsValue) -> Result<String, JsValue> {
    let columns: Vec<GridColumnDef> = from_js(columns)?;
    let rows: Vec<GridRow> = from_js(rows)?;
    Ok(export_csv_rows(&columns, &rows))
}

#[wasm_bindgen]
pub fn build_saved_state_js(context: JsValue) -> Result<JsValue, JsValue> {
    let context: BuildGridSavedStateContext = from_js(context)?;
    let result = build_grid_saved_state(context);
    to_js(&result)
}

#[wasm_bindgen]
pub fn normalize_saved_state_js(state: JsValue) -> Result<JsValue, JsValue> {
    let state: serde_json::Value = from_js(state)?;
    let result = normalize_grid_saved_state(&state);
    to_js(&result)
}

#[wasm_bindgen]
pub fn calculate_virtual_window_js(request: JsValue) -> Result<JsValue, JsValue> {
    let request: VirtualWindowRequest = from_js(request)?;
    let result = calculate_virtual_window(&request);
    to_js(&result)
}
