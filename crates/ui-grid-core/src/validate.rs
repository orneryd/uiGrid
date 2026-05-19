use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

use crate::models::{GridColumnDef, GridLabels, GridRecord};

/// Marker returned from [`GridValidatorRegistry::get_validator`]. Rust
/// cannot return a `dyn Fn` to JS, so callers receive a record telling
/// the bridge whether the named validator is one of the built-ins
/// (Rust runs the check synchronously) or a consumer registration
/// (the host must invoke its callback to evaluate the rule).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostValidatorMarker {
    pub name: String,
    pub built_in: bool,
}

/// A consumer-registered validator's message template. The actual
/// validator function lives in the host language (JS for web, native
/// for egui) — closures can't cross the wasm boundary, so the Rust
/// registry only retains enough metadata to surface error messages and
/// answer `has(name)` lookups. The host bridge runs the actual check
/// and reports invalid via [`set_grid_cell_error`].
///
/// `message_template` may include the literal substring `"THRESHOLD"`,
/// which is replaced with the validator argument's stringified form to
/// match the built-in `minLength` / `maxLength` shape.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredValidatorMessage {
    pub message_template: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridValidatorRegistry {
    labels: GridLabels,
    /// Consumer-registered validator name → message template. Mutated
    /// via [`GridValidatorRegistry::set_validator`] which mirrors the
    /// TS `setValidator` mutation surface. Validator functions remain
    /// host-side; the registry only stores message metadata so error
    /// surfacing works without crossing the wasm boundary.
    #[serde(default)]
    extras: BTreeMap<String, RegisteredValidatorMessage>,
}

pub fn create_grid_validator_registry(labels: &GridLabels) -> GridValidatorRegistry {
    GridValidatorRegistry {
        labels: labels.clone(),
        extras: BTreeMap::new(),
    }
}

impl GridValidatorRegistry {
    pub fn has(&self, name: &str) -> bool {
        matches!(name, "required" | "minLength" | "maxLength") || self.extras.contains_key(name)
    }

    /// Register a consumer validator's message template. Mirrors the TS
    /// `GridValidatorRegistry.setValidator` mutation entry point — the
    /// actual validator function lives host-side and is invoked through
    /// the wasm bridge.
    pub fn set_validator(&mut self, name: impl Into<String>, message_template: impl Into<String>) {
        self.extras.insert(
            name.into(),
            RegisteredValidatorMessage {
                message_template: message_template.into(),
            },
        );
    }

    /// Mirror of TS `GridValidatorRegistry.getValidator` — the Rust
    /// counterpart cannot return a closure, so consumers asking for a
    /// validator by name receive a marker [`HostValidatorMarker`]
    /// indicating the host must run the check. The error path matches
    /// TS: an unknown name produces `Invalid validator name: <name>`.
    pub fn get_validator(&self, name: &str) -> Result<HostValidatorMarker, String> {
        if self.has(name) {
            Ok(HostValidatorMarker {
                name: name.to_string(),
                built_in: matches!(name, "required" | "minLength" | "maxLength"),
            })
        } else {
            Err(format!("Invalid validator name: {name}"))
        }
    }

    pub fn get_message(&self, name: &str, argument: &Value) -> String {
        match name {
            "required" => self.labels.validate_required.clone(),
            "minLength" => self
                .labels
                .validate_min_length
                .replace("THRESHOLD", &value_to_string(argument)),
            "maxLength" => self
                .labels
                .validate_max_length
                .replace("THRESHOLD", &value_to_string(argument)),
            other => self
                .extras
                .get(other)
                .map(|entry| {
                    entry
                        .message_template
                        .replace("THRESHOLD", &value_to_string(argument))
                })
                .unwrap_or_default(),
        }
    }

    pub fn run_validator(
        &self,
        name: &str,
        argument: &Value,
        _old_value: &Value,
        new_value: &Value,
    ) -> Result<bool, String> {
        match name {
            "required" => {
                if !argument.as_bool().unwrap_or(false) {
                    return Ok(true);
                }
                Ok(!(new_value.is_null()
                    || matches!(new_value, Value::String(value) if value.is_empty())))
            }
            "minLength" => {
                if is_blank(new_value) {
                    return Ok(true);
                }
                let threshold = value_to_string(argument).parse::<usize>().unwrap_or(0);
                Ok(value_to_string(new_value).len() >= threshold)
            }
            "maxLength" => {
                if is_blank(new_value) {
                    return Ok(true);
                }
                let threshold = value_to_string(argument)
                    .parse::<usize>()
                    .unwrap_or(usize::MAX);
                Ok(value_to_string(new_value).len() <= threshold)
            }
            _ => Err(format!("Invalid validator name: {name}")),
        }
    }
}

pub fn invalid_field_for(col_def: &GridColumnDef) -> String {
    format!("$$invalid{}", col_def.name)
}

pub fn errors_field_for(col_def: &GridColumnDef) -> String {
    format!("$$errors{}", col_def.name)
}

pub fn is_grid_cell_invalid(row_entity: &GridRecord, col_def: &GridColumnDef) -> bool {
    row_entity
        .as_object()
        .and_then(|row| row.get(&invalid_field_for(col_def)))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

pub fn set_grid_cell_invalid(row_entity: &mut GridRecord, col_def: &GridColumnDef) {
    ensure_object(row_entity).insert(invalid_field_for(col_def), Value::Bool(true));
}

pub fn set_grid_cell_valid(row_entity: &mut GridRecord, col_def: &GridColumnDef) {
    ensure_object(row_entity).remove(&invalid_field_for(col_def));
}

pub fn set_grid_cell_error(
    row_entity: &mut GridRecord,
    col_def: &GridColumnDef,
    validator_name: &str,
) {
    let errors_key = errors_field_for(col_def);
    let row = ensure_object(row_entity);
    let bag = row
        .entry(errors_key)
        .or_insert_with(|| Value::Object(Map::new()));
    if let Value::Object(map) = bag {
        map.insert(validator_name.to_string(), Value::Bool(true));
    }
}

pub fn clear_grid_cell_error(
    row_entity: &mut GridRecord,
    col_def: &GridColumnDef,
    validator_name: &str,
) {
    let Some(row) = row_entity.as_object_mut() else {
        return;
    };
    let Some(Value::Object(map)) = row.get_mut(&errors_field_for(col_def)) else {
        return;
    };
    map.remove(validator_name);
}

pub fn get_grid_cell_error_names(row_entity: &GridRecord, col_def: &GridColumnDef) -> Vec<String> {
    let Some(row) = row_entity.as_object() else {
        return Vec::new();
    };
    let Some(Value::Object(map)) = row.get(&errors_field_for(col_def)) else {
        return Vec::new();
    };

    let mut names = map
        .iter()
        .filter(|(_, value)| value.as_bool().unwrap_or(false))
        .map(|(name, _)| name.clone())
        .collect::<Vec<_>>();
    names.sort();
    names
}

pub fn get_grid_cell_error_messages(
    row_entity: &GridRecord,
    col_def: &GridColumnDef,
    registry: &GridValidatorRegistry,
) -> Vec<String> {
    let Some(validators) = &col_def.validators else {
        return Vec::new();
    };
    get_grid_cell_error_names(row_entity, col_def)
        .into_iter()
        .map(|name| registry.get_message(&name, validators.get(&name).unwrap_or(&Value::Null)))
        .collect()
}

pub fn run_grid_cell_validators(
    row_entity: &mut GridRecord,
    col_def: &GridColumnDef,
    new_value: &Value,
    old_value: &Value,
    registry: &GridValidatorRegistry,
) -> Result<Vec<String>, String> {
    if new_value == old_value {
        return Ok(Vec::new());
    }
    if col_def.name.is_empty() {
        return Err("colDef.name is required to perform validation".to_string());
    }

    set_grid_cell_valid(row_entity, col_def);
    let mut failures = Vec::new();
    let validators = col_def.validators.clone().unwrap_or_default();

    for (validator_name, argument) in validators {
        clear_grid_cell_error(row_entity, col_def, &validator_name);
        let result = registry.run_validator(&validator_name, &argument, old_value, new_value)?;
        if !result {
            set_grid_cell_invalid(row_entity, col_def);
            set_grid_cell_error(row_entity, col_def, &validator_name);
            failures.push(validator_name);
        }
    }

    failures.sort();
    Ok(failures)
}

pub fn validate_all_grid_rows(
    row_entities: &mut [GridRecord],
    column_defs: &[GridColumnDef],
    registry: &GridValidatorRegistry,
) -> Result<Vec<GridRecord>, String> {
    let mut invalid_rows = Vec::new();

    for row in row_entities.iter_mut() {
        let mut row_invalid = false;
        for col_def in column_defs {
            if col_def.validators.is_none() {
                continue;
            }
            let value = get_row_value(row, col_def);
            let failures = run_grid_cell_validators(
                row,
                col_def,
                &value,
                &Value::String("\0_initial".to_string()),
                registry,
            )?;
            if !failures.is_empty() {
                row_invalid = true;
            }
        }
        if row_invalid {
            invalid_rows.push(row.clone());
        }
    }

    Ok(invalid_rows)
}

fn ensure_object(value: &mut GridRecord) -> &mut Map<String, Value> {
    if !value.is_object() {
        *value = Value::Object(Map::new());
    }
    value.as_object_mut().expect("row entity object")
}

fn get_row_value(row: &GridRecord, col_def: &GridColumnDef) -> Value {
    let key = col_def.field.as_ref().unwrap_or(&col_def.name);
    row.as_object()
        .and_then(|map| map.get(key).cloned())
        .unwrap_or(Value::Null)
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        other => other.to_string(),
    }
}

fn is_blank(value: &Value) -> bool {
    value.is_null() || matches!(value, Value::String(text) if text.is_empty())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn column(name: &str, validators: Option<Map<String, Value>>) -> GridColumnDef {
        GridColumnDef {
            name: name.to_string(),
            validators,
            ..GridColumnDef::default()
        }
    }

    #[test]
    fn built_in_registry_matches_default_messages_and_rules() {
        let labels = GridLabels::default();
        let registry = create_grid_validator_registry(&labels);

        assert!(
            !registry
                .run_validator(
                    "required",
                    &Value::Bool(true),
                    &Value::Null,
                    &Value::String(String::new())
                )
                .unwrap()
        );
        assert!(
            registry
                .run_validator("minLength", &json!(3), &Value::Null, &json!("abc"))
                .unwrap()
        );
        assert!(
            !registry
                .run_validator("maxLength", &json!(3), &Value::Null, &json!("abcd"))
                .unwrap()
        );
        assert_eq!(
            registry.get_message("required", &Value::Bool(true)),
            labels.validate_required
        );
        assert!(registry.get_message("minLength", &json!(5)).contains('5'));
    }

    #[test]
    fn invalid_and_error_helpers_update_entity_flags() {
        let mut row = json!({});
        let col_def = column("name", None);
        set_grid_cell_invalid(&mut row, &col_def);
        assert!(is_grid_cell_invalid(&row, &col_def));
        set_grid_cell_error(&mut row, &col_def, "required");
        set_grid_cell_error(&mut row, &col_def, "minLength");
        clear_grid_cell_error(&mut row, &col_def, "required");
        assert_eq!(
            get_grid_cell_error_names(&row, &col_def),
            vec!["minLength".to_string()]
        );
        set_grid_cell_valid(&mut row, &col_def);
        assert!(!is_grid_cell_invalid(&row, &col_def));
    }

    #[test]
    fn run_cell_validators_marks_failures_and_messages() {
        let labels = GridLabels::default();
        let registry = create_grid_validator_registry(&labels);
        let mut row = json!({});
        let col_def = column(
            "name",
            Some(serde_json::from_value(json!({ "required": true, "minLength": 5 })).unwrap()),
        );

        let failures = run_grid_cell_validators(
            &mut row,
            &col_def,
            &Value::String(String::new()),
            &Value::String("prev".to_string()),
            &registry,
        )
        .unwrap();

        assert_eq!(failures, vec!["required".to_string()]);
        assert!(is_grid_cell_invalid(&row, &col_def));
        assert_eq!(
            get_grid_cell_error_messages(&row, &col_def, &registry),
            vec![labels.validate_required]
        );
    }

    #[test]
    fn validate_all_rows_returns_only_invalid_rows() {
        let labels = GridLabels::default();
        let registry = create_grid_validator_registry(&labels);
        let col_defs = vec![column(
            "name",
            Some(serde_json::from_value(json!({ "required": true })).unwrap()),
        )];
        let mut rows = vec![
            json!({ "name": "Alpha" }),
            json!({ "name": "" }),
            json!({ "name": null }),
        ];

        let invalid = validate_all_grid_rows(&mut rows, &col_defs, &registry).unwrap();

        assert_eq!(invalid.len(), 2);
        assert!(invalid.contains(
            &json!({ "name": "", "$$invalidname": true, "$$errorsname": { "required": true } })
        ));
        assert!(invalid.contains(
            &json!({ "name": null, "$$invalidname": true, "$$errorsname": { "required": true } })
        ));
    }
}
