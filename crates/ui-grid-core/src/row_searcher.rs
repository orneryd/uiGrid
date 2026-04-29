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

fn build_literal_pattern(term: &Value) -> String {
    escape_reg_exp(term.as_str().unwrap_or_default())
}

fn build_wildcard_pattern(term: &str) -> Option<String> {
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
        return ParsedCondition::Comparator(FilterCondition::Contains);
    };

    if term.contains('*') {
        if let Some(pattern) = build_wildcard_pattern(&term) {
            return ParsedCondition::Regex(regex_from_pattern(
                &format!("^{pattern}$"),
                filter.flags.case_sensitive,
            ));
        }
    }

    ParsedCondition::Comparator(FilterCondition::Contains)
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
                &format!("^{}", build_literal_pattern(term.as_ref().unwrap_or(&Value::Null))),
                filter.flags.case_sensitive,
            )),
            FilterCondition::EndsWith => ParsedCondition::Regex(regex_from_pattern(
                &format!("{}$", build_literal_pattern(term.as_ref().unwrap_or(&Value::Null))),
                filter.flags.case_sensitive,
            )),
            FilterCondition::Exact => ParsedCondition::Regex(regex_from_pattern(
                &format!("^{}$", build_literal_pattern(term.as_ref().unwrap_or(&Value::Null))),
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
            FilterCondition::NotEqual => value_to_string(&value) != value_to_string(filter.term.as_ref().unwrap_or(&Value::Null)),
            FilterCondition::GreaterThan => compare_numeric_or_string(&value, filter.term.as_ref()) > 0,
            FilterCondition::GreaterThanOrEqual => compare_numeric_or_string(&value, filter.term.as_ref()) >= 0,
            FilterCondition::LessThan => compare_numeric_or_string(&value, filter.term.as_ref()) < 0,
            FilterCondition::LessThanOrEqual => compare_numeric_or_string(&value, filter.term.as_ref()) <= 0,
            _ => true,
        },
    }
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::String(value) => value.clone(),
        other => other.to_string(),
    }
}

fn compare_numeric_or_string(value: &Value, term: Option<&Value>) -> i8 {
    let term = term.unwrap_or(&Value::Null);

    if let (Some(left), Some(right)) = (value.as_f64(), term.as_f64()) {
        return match left.partial_cmp(&right) {
            Some(std::cmp::Ordering::Less) => -1,
            Some(std::cmp::Ordering::Equal) => 0,
            Some(std::cmp::Ordering::Greater) => 1,
            None => 0,
        };
    }

    match value_to_string(value).cmp(&value_to_string(term)) {
        std::cmp::Ordering::Less => -1,
        std::cmp::Ordering::Equal => 0,
        std::cmp::Ordering::Greater => 1,
    }
}