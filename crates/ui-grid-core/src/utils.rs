use serde_json::Value;

use crate::models::{GridColumnDef, GridRecord};

const PROTECTED_PATH_SEGMENTS: &[&str] = &["__proto__", "constructor", "prototype"];

pub fn is_null_or_undefined(value: &Value) -> bool {
    value.is_null()
}

pub fn get_path_value(record: &GridRecord, path: &str) -> Option<Value> {
    let mut current = record;

    for part in path.split('.') {
        if PROTECTED_PATH_SEGMENTS.contains(&part) {
            return None;
        }

        match current {
            Value::Object(map) => {
                current = map.get(part)?;
            }
            _ => return None,
        }
    }

    Some(current.clone())
}

pub fn get_cell_value(row: &GridRecord, column: &GridColumnDef) -> Value {
    if let Some(field) = &column.field {
        return get_path_value(row, field).unwrap_or(Value::Null);
    }

    match row {
        Value::Object(map) => map.get(&column.name).cloned().unwrap_or(Value::Null),
        _ => Value::Null,
    }
}

pub fn stringify_cell_value(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => value.clone(),
        Value::Array(values) => values
            .iter()
            .map(stringify_cell_value)
            .collect::<Vec<_>>()
            .join(", "),
        Value::Object(_) => serde_json::to_string(value).unwrap_or_default(),
    }
}

pub fn to_csv_value(value: &str) -> String {
    let mut escaped = value.to_string();

    if matches!(
        escaped.chars().next(),
        Some('=' | '+' | '-' | '@' | '\t' | '\r')
    ) {
        escaped = format!("'{}", escaped);
    }

    if escaped.contains([',', '"', '\n']) {
        return format!("\"{}\"", escaped.replace('"', "\"\""));
    }

    escaped
}

pub fn titleize(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut previous_is_lower_or_digit = false;

    for ch in value.chars() {
        if matches!(ch, '_' | '.' | '-') {
            if !output.ends_with(' ') {
                output.push(' ');
            }
            previous_is_lower_or_digit = false;
            continue;
        }

        if previous_is_lower_or_digit && ch.is_ascii_uppercase() && !output.ends_with(' ') {
            output.push(' ');
        }

        output.push(ch);
        previous_is_lower_or_digit = ch.is_ascii_lowercase() || ch.is_ascii_digit();
    }

    let compact = output.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut chars = compact.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}
