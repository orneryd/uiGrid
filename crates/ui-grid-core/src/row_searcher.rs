use regex::{Regex, RegexBuilder};
use serde_json::Value;

use crate::{
    constants::FilterCondition,
    models::{GridColumnDef, GridFilterDescriptor, GridRecord},
    utils::{get_cell_value, is_null_or_undefined},
};

#[derive(Debug, Clone)]
pub enum ParsedCondition {
    Regex(Regex),
    Comparator(FilterCondition),
}

#[derive(Debug, Clone)]
pub struct ParsedFilter {
    pub term: Option<Value>,
    pub condition: ParsedCondition,
    pub case_sensitive: bool,
    pub date: bool,
}

const MAX_FILTER_PATTERN_LENGTH: usize = 128;
const MAX_FILTER_WILDCARDS: usize = 8;

fn escape_reg_exp(value: &str) -> String {
    regex::escape(value).replace('-', "\\x2d")
}

pub fn get_term(filter: &GridFilterDescriptor) -> Option<Value> {
    filter.term.as_ref().map(|term| match term {
        Value::String(value) => Value::String(value.trim().to_string()),
        other => other.clone(),
    })
}

fn strip_term(filter: &GridFilterDescriptor) -> Option<Value> {
    get_term(filter).map(|term| match term {
        Value::String(value) => Value::String(value.trim_matches('*').to_string()),
        other => other,
    })
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::String(value) => value.clone(),
        other => other.to_string(),
    }
}

fn build_literal_pattern(term: &Value) -> String {
    escape_reg_exp(&value_to_string(term))
}

/// Build a regex pattern for a `*`-bearing filter term, or return `None`
/// when the term is too long / has too many wildcards. Public so the
/// wasm bridge can mirror the TS contract for `matcherKind` reporting.
pub fn build_wildcard_pattern(term: &str) -> Option<String> {
    let wildcard_count = term.matches('*').count();
    if term.len() > MAX_FILTER_PATTERN_LENGTH || wildcard_count > MAX_FILTER_WILDCARDS {
        return None;
    }

    Some(escape_reg_exp(term).replace("\\*", ".*?"))
}

fn regex_from_pattern(pattern: &str, case_sensitive: bool) -> Regex {
    RegexBuilder::new(pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .expect("valid regex pattern")
}

fn guess_condition(filter: &GridFilterDescriptor) -> ParsedCondition {
    let Some(Value::String(term)) = get_term(filter) else {
        // No term → match anything (matches the TS `containsRE` over an empty
        // pattern).
        return ParsedCondition::Regex(regex_from_pattern("", filter.flags.case_sensitive));
    };

    if term.contains('*')
        && let Some(pattern) = build_wildcard_pattern(&term)
    {
        return ParsedCondition::Regex(regex_from_pattern(
            &format!("^{pattern}$"),
            filter.flags.case_sensitive,
        ));
    }
    // If we get here either the term has no wildcards, or the wildcard was
    // rejected (too long / too many `*`s) — fall through to a literal
    // substring regex on the original term.

    // Default `contains` is a substring regex over the literal-escaped term —
    // mirrors the TS `setupFilters` `containsRE` path. `run_column_filter`'s
    // comparator branch has no Contains arm; emitting `Comparator(Contains)`
    // here would silently match everything and break TS parity.
    ParsedCondition::Regex(regex_from_pattern(
        &build_literal_pattern(&Value::String(term)),
        filter.flags.case_sensitive,
    ))
}

pub fn setup_filters(filters: &[GridFilterDescriptor]) -> Vec<ParsedFilter> {
    let mut parsed_filters = Vec::new();

    for filter in filters {
        if !filter.no_term {
            let Some(term) = &filter.term else {
                continue;
            };
            if is_null_or_undefined(term) {
                continue;
            }
        }

        let term = if filter.raw_term {
            filter.term.clone()
        } else {
            strip_term(filter)
        };

        let condition = match filter.condition.unwrap_or(FilterCondition::Contains) {
            FilterCondition::StartsWith => ParsedCondition::Regex(regex_from_pattern(
                &format!(
                    "^{}",
                    build_literal_pattern(term.as_ref().unwrap_or(&Value::Null))
                ),
                filter.flags.case_sensitive,
            )),
            FilterCondition::EndsWith => ParsedCondition::Regex(regex_from_pattern(
                &format!(
                    "{}$",
                    build_literal_pattern(term.as_ref().unwrap_or(&Value::Null))
                ),
                filter.flags.case_sensitive,
            )),
            FilterCondition::Exact => ParsedCondition::Regex(regex_from_pattern(
                &format!(
                    "^{}$",
                    build_literal_pattern(term.as_ref().unwrap_or(&Value::Null))
                ),
                filter.flags.case_sensitive,
            )),
            FilterCondition::Contains => {
                if filter.condition.is_none() {
                    guess_condition(filter)
                } else {
                    ParsedCondition::Regex(regex_from_pattern(
                        &build_literal_pattern(term.as_ref().unwrap_or(&Value::Null)),
                        filter.flags.case_sensitive,
                    ))
                }
            }
            comparator => ParsedCondition::Comparator(comparator),
        };

        parsed_filters.push(ParsedFilter {
            term,
            condition,
            case_sensitive: filter.flags.case_sensitive,
            date: filter.flags.date,
        });
    }

    parsed_filters
}

pub fn run_column_filter(row: &GridRecord, column: &GridColumnDef, filter: &ParsedFilter) -> bool {
    let mut value = get_cell_value(row, column);
    if value.is_null() {
        value = Value::String(String::new());
    }

    match &filter.condition {
        ParsedCondition::Regex(regex) => regex.is_match(&value_to_string(&value)),
        ParsedCondition::Comparator(condition) => match condition {
            FilterCondition::NotEqual => {
                value_to_string(&value)
                    != value_to_string(filter.term.as_ref().unwrap_or(&Value::Null))
            }
            FilterCondition::GreaterThan => {
                compare_filter_values(&value, filter.term.as_ref(), filter.date) > 0
            }
            FilterCondition::GreaterThanOrEqual => {
                compare_filter_values(&value, filter.term.as_ref(), filter.date) >= 0
            }
            FilterCondition::LessThan => {
                compare_filter_values(&value, filter.term.as_ref(), filter.date) < 0
            }
            FilterCondition::LessThanOrEqual => {
                compare_filter_values(&value, filter.term.as_ref(), filter.date) <= 0
            }
            _ => true,
        },
    }
}

fn coerce_numeric_term(value: &Value, term: &Value) -> Option<Value> {
    if !value.is_number() {
        return None;
    }

    let Value::String(raw_term) = term else {
        return None;
    };

    let numeric = raw_term.replace(r#"\."#, ".").replace(r#"\-"#, "-");
    numeric.parse::<f64>().ok().map(|parsed| {
        Value::Number(serde_json::Number::from_f64(parsed).expect("finite numeric filter term"))
    })
}

fn normalize_date_value(value: &Value) -> Value {
    match value {
        Value::String(value) => Value::String(value.replace('\\', "")),
        other => other.clone(),
    }
}

fn compare_filter_values(value: &Value, term: Option<&Value>, date: bool) -> i8 {
    let mut left = value.clone();
    let mut right = term.cloned().unwrap_or(Value::Null);

    if let Some(coerced) = coerce_numeric_term(&left, &right) {
        right = coerced;
    }

    if date {
        left = normalize_date_value(&left);
        right = normalize_date_value(&right);
    }

    if let (Some(left), Some(right)) = (left.as_f64(), right.as_f64()) {
        return match left.partial_cmp(&right) {
            Some(std::cmp::Ordering::Less) => -1,
            Some(std::cmp::Ordering::Equal) => 0,
            Some(std::cmp::Ordering::Greater) => 1,
            None => 0,
        };
    }

    match value_to_string(&left).cmp(&value_to_string(&right)) {
        std::cmp::Ordering::Less => -1,
        std::cmp::Ordering::Equal => 0,
        std::cmp::Ordering::Greater => 1,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn column(name: &str) -> GridColumnDef {
        GridColumnDef {
            name: name.to_string(),
            ..GridColumnDef::default()
        }
    }

    #[test]
    fn setup_filters_uses_literal_contains_for_oversized_wildcards() {
        let filters = setup_filters(&[GridFilterDescriptor {
            term: Some(Value::String("a*a*a*a*a*a*a*a*a*a*".to_string())),
            ..GridFilterDescriptor::default()
        }]);

        // Wildcard rejected (too many `*`s) → falls through to a literal
        // substring regex on the original term, mirroring the TS
        // `setupFilters` `containsRE` path.
        assert!(matches!(filters[0].condition, ParsedCondition::Regex(_)));
        assert!(run_column_filter(
            &json!({ "status": "a*a*a*a*a*a*a*a*a*a*" }),
            &column("status"),
            &filters[0],
        ));
        // The substring matches when the cell contains the literal term.
        assert!(run_column_filter(
            &json!({ "status": "prefix a*a*a*a*a*a*a*a*a*a* suffix" }),
            &column("status"),
            &filters[0],
        ));
        // …and rejects when it doesn't.
        assert!(!run_column_filter(
            &json!({ "status": "totally different" }),
            &column("status"),
            &filters[0],
        ));
    }

    #[test]
    fn numeric_string_terms_are_coerced_for_numeric_comparisons() {
        let filters = setup_filters(&[GridFilterDescriptor {
            term: Some(Value::String("200".to_string())),
            condition: Some(FilterCondition::GreaterThan),
            ..GridFilterDescriptor::default()
        }]);

        assert!(run_column_filter(
            &json!({ "revenue": 250 }),
            &column("revenue"),
            &filters[0],
        ));
        assert!(!run_column_filter(
            &json!({ "revenue": 150 }),
            &column("revenue"),
            &filters[0],
        ));
    }

    #[test]
    fn date_flag_compares_normalized_string_values() {
        let filters = setup_filters(&[GridFilterDescriptor {
            term: Some(Value::String("2026-02-01".to_string())),
            condition: Some(FilterCondition::GreaterThanOrEqual),
            raw_term: true,
            flags: crate::models::GridFilterFlags {
                case_sensitive: false,
                date: true,
            },
            ..GridFilterDescriptor::default()
        }]);

        assert!(run_column_filter(
            &json!({ "renewalDate": "2026-03-01" }),
            &column("renewalDate"),
            &filters[0],
        ));
        assert!(!run_column_filter(
            &json!({ "renewalDate": "2026-01-01" }),
            &column("renewalDate"),
            &filters[0],
        ));
    }

    #[test]
    fn get_term_trims_strings_but_preserves_non_strings() {
        assert_eq!(
            get_term(&GridFilterDescriptor {
                term: Some(Value::String("  Active  ".to_string())),
                ..GridFilterDescriptor::default()
            }),
            Some(Value::String("Active".to_string()))
        );
        assert_eq!(
            get_term(&GridFilterDescriptor {
                term: Some(Value::Number(42.into())),
                ..GridFilterDescriptor::default()
            }),
            Some(Value::Number(42.into()))
        );
    }
}
