use std::cmp::Ordering;

use serde_json::Value;

use crate::{
    models::{GridColumnDef, GridColumnType, GridRecord},
    utils::get_cell_value,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SortKind {
    Basic,
    Number,
    NumberString,
    Alpha,
    Date,
    Boolean,
}

fn compare_nulls(left: &Value, right: &Value) -> Option<Ordering> {
    match (left.is_null(), right.is_null()) {
        (true, true) => Some(Ordering::Equal),
        (true, false) => Some(Ordering::Greater),
        (false, true) => Some(Ordering::Less),
        (false, false) => None,
    }
}

fn parse_number_string(value: &str) -> Option<f64> {
    if value.trim() == "Infinity" || value.trim() == "-Infinity" {
        return value.trim().parse::<f64>().ok();
    }

    let filtered = value
        .chars()
        .filter(|ch| ch.is_ascii_digit() || matches!(ch, '.' | 'e' | 'E' | '-'))
        .collect::<String>();

    if filtered.is_empty() {
        return None;
    }

    filtered.parse::<f64>().ok()
}

fn compare_basic(left: &Value, right: &Value) -> Ordering {
    if let Some(ordering) = compare_nulls(left, right) {
        return ordering;
    }

    let left_text = left.to_string();
    let right_text = right.to_string();
    left_text.cmp(&right_text)
}

fn compare_numbers(left: &Value, right: &Value) -> Ordering {
    if let Some(ordering) = compare_nulls(left, right) {
        return ordering;
    }

    let left_number = left.as_f64().unwrap_or_default();
    let right_number = right.as_f64().unwrap_or_default();
    left_number.partial_cmp(&right_number).unwrap_or(Ordering::Equal)
}

fn compare_number_strings(left: &Value, right: &Value) -> Ordering {
    if let Some(ordering) = compare_nulls(left, right) {
        return ordering;
    }

    let left_parsed = parse_number_string(left.as_str().unwrap_or_default());
    let right_parsed = parse_number_string(right.as_str().unwrap_or_default());

    match (left_parsed, right_parsed) {
        (Some(left), Some(right)) => left.partial_cmp(&right).unwrap_or(Ordering::Equal),
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Greater,
        (Some(_), None) => Ordering::Less,
    }
}

fn compare_alpha(left: &Value, right: &Value) -> Ordering {
    if let Some(ordering) = compare_nulls(left, right) {
        return ordering;
    }

    left.as_str()
        .unwrap_or_default()
        .to_lowercase()
        .cmp(&right.as_str().unwrap_or_default().to_lowercase())
}

fn compare_date(left: &Value, right: &Value) -> Ordering {
    if let Some(ordering) = compare_nulls(left, right) {
        return ordering;
    }

    left.as_str().unwrap_or_default().cmp(right.as_str().unwrap_or_default())
}

fn compare_boolean(left: &Value, right: &Value) -> Ordering {
    if let Some(ordering) = compare_nulls(left, right) {
        return ordering;
    }

    match (left.as_bool().unwrap_or(false), right.as_bool().unwrap_or(false)) {
        (true, true) | (false, false) => Ordering::Equal,
        (true, false) => Ordering::Greater,
        (false, true) => Ordering::Less,
    }
}

pub fn guess_sort_kind(column: &GridColumnDef, rows: &[GridRecord]) -> SortKind {
    if column.r#type == GridColumnType::Number {
        return SortKind::Number;
    }
    if column.r#type == GridColumnType::Boolean {
        return SortKind::Boolean;
    }
    if column.r#type == GridColumnType::Date {
        return SortKind::Date;
    }

    let first_non_null = rows
        .iter()
        .map(|row| get_cell_value(row, column))
        .find(|value| !value.is_null());

    match first_non_null {
        Some(Value::Number(_)) => SortKind::Number,
        Some(Value::Bool(_)) => SortKind::Boolean,
        Some(Value::String(value)) if value.trim_start().starts_with('$') => SortKind::NumberString,
        Some(Value::String(_)) => SortKind::Alpha,
        Some(_) => SortKind::Basic,
        None => SortKind::Basic,
    }
}

pub fn compare_values(kind: SortKind, left: &Value, right: &Value) -> Ordering {
    match kind {
        SortKind::Basic => compare_basic(left, right),
        SortKind::Number => compare_numbers(left, right),
        SortKind::NumberString => compare_number_strings(left, right),
        SortKind::Alpha => compare_alpha(left, right),
        SortKind::Date => compare_date(left, right),
        SortKind::Boolean => compare_boolean(left, right),
    }
}