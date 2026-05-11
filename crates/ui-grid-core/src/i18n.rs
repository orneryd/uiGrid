use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::models::GridLabels;

type GridLabelOverrides = Map<String, Value>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridI18nService {
    #[serde(default = "default_locales")]
    pub locales: BTreeMap<String, GridLabelOverrides>,
    #[serde(default = "default_supported_languages")]
    pub supported_languages: Vec<String>,
    #[serde(default = "default_current_lang")]
    pub current_lang: String,
}

fn default_current_lang() -> String {
    "en-US".to_string()
}

fn parse_locale(json: &str) -> GridLabelOverrides {
    serde_json::from_str(json).expect("valid bundled locale json")
}

fn default_locales() -> BTreeMap<String, GridLabelOverrides> {
    BTreeMap::from([
        ("en-us".to_string(), GridLabelOverrides::new()),
        (
            "es".to_string(),
            parse_locale(include_str!(
                "../../../projects/ui-grid-core/src/lib/i18n/es.json"
            )),
        ),
        (
            "fr".to_string(),
            parse_locale(include_str!(
                "../../../projects/ui-grid-core/src/lib/i18n/fr.json"
            )),
        ),
        (
            "de".to_string(),
            parse_locale(include_str!(
                "../../../projects/ui-grid-core/src/lib/i18n/de.json"
            )),
        ),
        (
            "ja".to_string(),
            parse_locale(include_str!(
                "../../../projects/ui-grid-core/src/lib/i18n/ja.json"
            )),
        ),
        (
            "zh-cn".to_string(),
            parse_locale(include_str!(
                "../../../projects/ui-grid-core/src/lib/i18n/zh-CN.json"
            )),
        ),
    ])
}

fn default_supported_languages() -> Vec<String> {
    vec![
        "en-us".to_string(),
        "es".to_string(),
        "fr".to_string(),
        "de".to_string(),
        "ja".to_string(),
        "zh-cn".to_string(),
    ]
}

pub fn create_grid_i18n_service() -> GridI18nService {
    GridI18nService {
        locales: default_locales(),
        supported_languages: default_supported_languages(),
        current_lang: default_current_lang(),
    }
}

fn normalize_lang(lang: &str) -> String {
    lang.to_lowercase()
}

fn merge_labels(base: &GridLabels, overrides: &GridLabelOverrides) -> GridLabels {
    let mut value = serde_json::to_value(base).expect("grid labels serialize");
    let Value::Object(ref mut object) = value else {
        unreachable!("grid labels serialize as object")
    };
    for (key, override_value) in overrides {
        object.insert(key.clone(), override_value.clone());
    }
    serde_json::from_value(value).expect("merged grid labels deserialize")
}

pub fn add_grid_i18n_locale(service: &mut GridI18nService, lang: &str, labels: GridLabelOverrides) {
    let normalized = normalize_lang(lang);
    if !service.supported_languages.contains(&normalized) {
        service.supported_languages.push(normalized.clone());
    }
    service.locales.insert(normalized, labels);
}

pub fn get_grid_i18n_labels(service: &GridI18nService, lang: &str) -> GridLabels {
    let default_labels = GridLabels::default();
    let Some(registered) = service.locales.get(&normalize_lang(lang)) else {
        return default_labels;
    };
    merge_labels(&default_labels, registered)
}

pub fn set_grid_i18n_current_lang(service: &mut GridI18nService, lang: &str) {
    service.current_lang = lang.to_string();
}

pub fn get_grid_i18n_current_lang(service: &GridI18nService) -> String {
    service.current_lang.clone()
}

pub fn get_grid_i18n_supported_languages(service: &GridI18nService) -> Vec<String> {
    service.supported_languages.clone()
}

pub fn get_grid_i18n_current_labels(service: &GridI18nService) -> GridLabels {
    get_grid_i18n_labels(service, &service.current_lang)
}

pub fn resolve_labels_from_i18n(
    service: &GridI18nService,
    overrides: Option<GridLabelOverrides>,
) -> GridLabels {
    let current_labels = get_grid_i18n_current_labels(service);
    match overrides {
        Some(overrides) => merge_labels(&current_labels, &overrides),
        None => current_labels,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn defaults_to_english_and_bundled_languages() {
        let service = create_grid_i18n_service();
        assert_eq!(get_grid_i18n_current_lang(&service), "en-US");
        assert!(get_grid_i18n_supported_languages(&service).contains(&"es".to_string()));
        assert_eq!(
            get_grid_i18n_current_labels(&service),
            GridLabels::default()
        );
    }

    #[test]
    fn supports_partial_locale_overrides() {
        let mut service = create_grid_i18n_service();
        add_grid_i18n_locale(
            &mut service,
            "pt-br",
            serde_json::from_value(json!({ "sortDefault": "Ordenar" })).unwrap(),
        );
        let labels = get_grid_i18n_labels(&service, "PT-BR");
        assert_eq!(labels.sort_default, "Ordenar");
        assert_eq!(labels.group_column, GridLabels::default().group_column);
    }

    #[test]
    fn resolves_overrides_on_top_of_current_language() {
        let mut service = create_grid_i18n_service();
        set_grid_i18n_current_lang(&mut service, "es");
        let labels = resolve_labels_from_i18n(
            &service,
            Some(serde_json::from_value(json!({ "sortDefault": "Custom" })).unwrap()),
        );
        assert_eq!(labels.sort_default, "Custom");
        assert_eq!(labels.group_column, "Agrupar por esta columna");
    }
}
