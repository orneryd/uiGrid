use regex::Regex;
use serde_json::Value;

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        other => other.to_string(),
    }
}

pub fn resolve_grid_template_value(context: &Value, expression: &str) -> Value {
    let segments = expression.split('.').filter(|segment| !segment.is_empty());
    let mut current = context;

    for segment in segments {
        let Value::Object(map) = current else {
            return Value::String(String::new());
        };
        let Some(next) = map.get(segment) else {
            return Value::String(String::new());
        };
        current = next;
    }

    match current {
        Value::Null => Value::String(String::new()),
        other => other.clone(),
    }
}

pub fn interpolate_grid_template(template_markup: &str, context: &Value) -> String {
    let moustache = Regex::new(r"\{\{\s*([^}]+?)\s*\}\}").expect("valid moustache regex");
    let dollar = Regex::new(r"\$\{(.+?)\}").expect("valid dollar regex");

    let with_moustache = moustache.replace_all(template_markup, |captures: &regex::Captures| {
        let expression = captures
            .get(1)
            .map(|capture| capture.as_str())
            .unwrap_or("")
            .trim();
        let value = resolve_grid_template_value(context, expression);
        html_escape(&value_to_string(&value))
    });

    dollar
        .replace_all(&with_moustache, |captures: &regex::Captures| {
            let expression = captures
                .get(1)
                .map(|capture| capture.as_str())
                .unwrap_or("")
                .trim();
            let cleaned = expression
                .strip_prefix("this.")
                .or_else(|| expression.strip_prefix("props."))
                .unwrap_or(expression);
            let value = resolve_grid_template_value(context, cleaned);
            html_escape(&value_to_string(&value))
        })
        .into_owned()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn resolves_dotted_values_and_missing_paths() {
        let context = json!({ "row": { "account": { "owner": "Ada" } } });

        assert_eq!(
            resolve_grid_template_value(&context, "row.account.owner"),
            Value::String("Ada".to_string())
        );
        assert_eq!(
            resolve_grid_template_value(&context, "row.account.missing"),
            Value::String(String::new())
        );
    }

    #[test]
    fn interpolates_both_binding_styles_and_escapes_html() {
        let context = json!({
            "row": { "name": "Ada <Admin>", "role": "Owner" },
            "value": "5 > 4"
        });

        assert_eq!(
            interpolate_grid_template(
                "<span>{{ row.name }}</span><em>${props.row.role}</em><strong>${this.value}</strong>",
                &context,
            ),
            "<span>Ada &lt;Admin&gt;</span><em>Owner</em><strong>5 &gt; 4</strong>"
        );
    }
}
