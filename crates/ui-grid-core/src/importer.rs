use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{GridColumnDef, GridOptions, GridRecord};

pub type GridImporterHeaderMapping = Vec<Option<String>>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridImporterOptions {
    pub enable: Option<bool>,
    pub show_menu: Option<bool>,
}

pub fn resolve_grid_importer_options(options: &GridOptions) -> GridImporterOptions {
    GridImporterOptions {
        enable: options.enable_importer,
        show_menu: options.importer_show_menu,
    }
}

pub fn flatten_grid_column_defs_for_import(
    column_defs: &[GridColumnDef],
    header_filter: Option<&dyn Fn(&str) -> String>,
) -> BTreeMap<String, String> {
    let mut flattened = BTreeMap::new();
    for column_def in column_defs {
        let target = column_def
            .field
            .clone()
            .unwrap_or_else(|| column_def.name.clone());
        if !column_def.name.is_empty() {
            flattened.insert(column_def.name.clone(), target.clone());
            flattened.insert(column_def.name.to_lowercase(), target.clone());
        }
        if let Some(field) = &column_def.field {
            flattened.insert(field.clone(), target.clone());
            flattened.insert(field.to_lowercase(), target.clone());
        }
        if let Some(display_name) = &column_def.display_name {
            flattened.insert(display_name.clone(), target.clone());
            flattened.insert(display_name.to_lowercase(), target.clone());
            if let Some(filter) = header_filter {
                let filtered = filter(display_name);
                flattened.insert(filtered.clone(), target.clone());
                flattened.insert(filtered.to_lowercase(), target.clone());
            }
        }
    }
    flattened
}

pub fn default_grid_importer_process_headers(
    column_defs: Option<&[GridColumnDef]>,
    header_row: &[String],
    header_filter: Option<&dyn Fn(&str) -> String>,
) -> GridImporterHeaderMapping {
    if is_none_or(column_defs, |column_defs| column_defs.is_empty()) {
        return header_row
            .iter()
            .map(|value| Some(sanitize_header(value)))
            .collect();
    }

    let lookup =
        flatten_grid_column_defs_for_import(column_defs.unwrap_or_default(), header_filter);
    header_row
        .iter()
        .map(|value| {
            lookup
                .get(value)
                .cloned()
                .or_else(|| lookup.get(&value.to_lowercase()).cloned())
        })
        .collect()
}

pub fn create_grid_importer_new_object(new_object: Option<&dyn Fn() -> GridRecord>) -> GridRecord {
    new_object
        .map(|factory| factory())
        .unwrap_or_else(|| Value::Object(Default::default()))
}

pub fn apply_grid_importer_object_callback(
    object_callback: Option<&dyn Fn(GridRecord) -> GridRecord>,
    obj: GridRecord,
) -> GridRecord {
    object_callback
        .map(|callback| callback(obj.clone()))
        .unwrap_or(obj)
}

pub fn parse_grid_importer_json(source: &str) -> Result<Vec<GridRecord>, GridImporterJsonError> {
    let loaded: Value =
        serde_json::from_str(source).map_err(|_| GridImporterJsonError::InvalidJson)?;
    match loaded {
        Value::Array(values) => Ok(values),
        _ => Err(GridImporterJsonError::JsonNotArray),
    }
}

pub fn parse_grid_importer_csv(source: &str) -> Option<Vec<Vec<String>>> {
    if source.is_empty() {
        return None;
    }

    let mut rows = Vec::new();
    let mut current_row = Vec::new();
    let mut field = String::new();
    let mut in_quotes = false;
    let chars = source.chars().collect::<Vec<_>>();
    let mut index = 0;

    while index < chars.len() {
        let ch = chars[index];
        if in_quotes {
            if ch == '"' {
                if chars.get(index + 1) == Some(&'"') {
                    field.push('"');
                    index += 1;
                } else {
                    in_quotes = false;
                }
            } else {
                field.push(ch);
            }
        } else if ch == '"' {
            in_quotes = true;
        } else if ch == ',' {
            current_row.push(std::mem::take(&mut field));
        } else if ch == '\n' {
            current_row.push(std::mem::take(&mut field));
            rows.push(std::mem::take(&mut current_row));
        } else if ch == '\r' {
            if chars.get(index + 1) != Some(&'\n') {
                current_row.push(std::mem::take(&mut field));
                rows.push(std::mem::take(&mut current_row));
            }
        } else {
            field.push(ch);
        }
        index += 1;
    }

    if !field.is_empty() || !current_row.is_empty() {
        current_row.push(field);
        rows.push(current_row);
    }

    (!rows.is_empty()).then_some(rows)
}

pub fn build_grid_importer_objects_from_csv(
    import_array: &[Vec<String>],
    column_defs: Option<&[GridColumnDef]>,
) -> Option<Vec<GridRecord>> {
    let (header_row, data_rows) = import_array.split_first()?;
    let header_mapping = default_grid_importer_process_headers(column_defs, header_row, None);

    let mut result = Vec::new();
    for row in data_rows {
        let mut obj = create_grid_importer_new_object(None);
        let Value::Object(map) = &mut obj else {
            continue;
        };
        for (index, value) in row.iter().enumerate() {
            if let Some(Some(key)) = header_mapping.get(index) {
                map.insert(key.clone(), Value::String(value.clone()));
            }
        }
        result.push(obj);
    }
    Some(result)
}

pub fn build_grid_importer_objects_from_json(parsed: &[GridRecord]) -> Vec<GridRecord> {
    parsed
        .iter()
        .map(|value| {
            let mut obj = create_grid_importer_new_object(None);
            if let (Value::Object(target), Value::Object(source)) = (&mut obj, value) {
                for (key, value) in source {
                    target.insert(key.clone(), value.clone());
                }
            }
            obj
        })
        .collect()
}

fn sanitize_header(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            '0'..='9' | 'a'..='z' | 'A'..='Z' | '-' | '_' => ch,
            _ => '_',
        })
        .collect()
}

fn is_none_or<T>(value: Option<T>, predicate: impl FnOnce(T) -> bool) -> bool {
    match value {
        None => true,
        Some(value) => predicate(value),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GridImporterJsonError {
    InvalidJson,
    JsonNotArray,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn column_defs() -> Vec<GridColumnDef> {
        vec![
            GridColumnDef {
                name: "id".to_string(),
                field: Some("id".to_string()),
                ..GridColumnDef::default()
            },
            GridColumnDef {
                name: "name".to_string(),
                display_name: Some("Full Name".to_string()),
                ..GridColumnDef::default()
            },
            GridColumnDef {
                name: "status".to_string(),
                ..GridColumnDef::default()
            },
        ]
    }

    #[test]
    fn flattens_headers_and_processes_defaults() {
        let lookup = flatten_grid_column_defs_for_import(&column_defs(), None);
        assert_eq!(lookup.get("id"), Some(&"id".to_string()));
        assert_eq!(lookup.get("Full Name"), Some(&"name".to_string()));
        assert_eq!(lookup.get("full name"), Some(&"name".to_string()));

        let filtered =
            flatten_grid_column_defs_for_import(&column_defs(), Some(&|name| format!("*{name}*")));
        assert_eq!(filtered.get("*Full Name*"), Some(&"name".to_string()));

        assert_eq!(
            default_grid_importer_process_headers(
                None,
                &["First Name".to_string(), "e/mail".to_string()],
                None
            ),
            vec![Some("First_Name".to_string()), Some("e_mail".to_string())]
        );
    }

    #[test]
    fn parses_json_and_csv_inputs() {
        assert_eq!(
            parse_grid_importer_json("[{\"id\":1}]").unwrap(),
            vec![json!({ "id": 1 })]
        );
        assert_eq!(
            parse_grid_importer_json("not json"),
            Err(GridImporterJsonError::InvalidJson)
        );
        assert_eq!(
            parse_grid_importer_json("{\"id\":1}"),
            Err(GridImporterJsonError::JsonNotArray)
        );

        assert_eq!(
            parse_grid_importer_csv("name,notes\n\"Alpha, Inc\",\"He said \"\"hi\"\"\"").unwrap(),
            vec![
                vec!["name".to_string(), "notes".to_string()],
                vec!["Alpha, Inc".to_string(), "He said \"hi\"".to_string()],
            ]
        );
    }

    #[test]
    fn builds_objects_from_csv_and_json() {
        let csv = vec![
            vec![
                "id".to_string(),
                "Full Name".to_string(),
                "status".to_string(),
            ],
            vec!["1".to_string(), "Alpha".to_string(), "Active".to_string()],
        ];
        assert_eq!(
            build_grid_importer_objects_from_csv(&csv, Some(&column_defs())).unwrap(),
            vec![json!({ "id": "1", "name": "Alpha", "status": "Active" })]
        );
        assert_eq!(
            build_grid_importer_objects_from_json(&[json!({ "id": 1 }), json!({ "id": 2 })]),
            vec![json!({ "id": 1 }), json!({ "id": 2 })]
        );
    }
}
