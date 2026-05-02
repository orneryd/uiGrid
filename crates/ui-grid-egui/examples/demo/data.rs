use serde_json::{Value, json};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Dataset {
    Flat,
    Tree,
    Large,
    Huge,
}

impl Dataset {
    pub fn rows(&self) -> Vec<Value> {
        match self {
            Dataset::Flat => enrich_rows(ui_grid_fixtures::sample_rows()),
            Dataset::Tree => enrich_rows(ui_grid_fixtures::sample_tree_rows()),
            Dataset::Large => enrich_rows(generate_large_dataset(60)),
            Dataset::Huge => enrich_rows(generate_large_dataset(100_000)),
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Dataset::Flat => "Flat (4 rows)",
            Dataset::Tree => "Tree",
            Dataset::Large => "Large (60 rows)",
            Dataset::Huge => "Huge (100K rows)",
        }
    }
}

const OWNERS: &[&str] = &[
    "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank", "Ivy", "Jack", "Karen",
    "Leo", "Mona", "Nick", "Olivia", "Pat",
];
const STATUSES: &[&str] = &["Active", "Trial", "Churned", "Suspended"];
const TIERS: &[&str] = &["Enterprise", "Starter", "Legacy", "Pro"];
const REGIONS: &[&str] = &["North America", "Europe", "LATAM", "APAC"];
const SEGMENTS: &[&str] = &["Enterprise", "Mid-Market", "SMB", "Public Sector"];
const MANAGERS: &[&str] = &["Morgan", "Jules", "Riley", "Parker", "Casey"];
const HEALTH: &[&str] = &["Excellent", "Healthy", "Watch", "At Risk"];

fn generate_large_dataset(n: usize) -> Vec<Value> {
    (0..n)
        .map(|i| {
            json!({
                "id": format!("row-{}", i + 1),
                "owner": OWNERS[i % OWNERS.len()],
                "status": STATUSES[i % STATUSES.len()],
                "revenue": (i * 137 + 50) % 5000,
                "enabled": i % 3 != 0,
                "renewal": format!("2026-{:02}-{:02}", (i % 12) + 1, (i % 28) + 1),
                "tier": TIERS[i % TIERS.len()],
            })
        })
        .collect()
}

fn enrich_rows(rows: Vec<Value>) -> Vec<Value> {
    rows.into_iter()
        .enumerate()
        .map(|(index, row)| enrich_row(row, index, 0))
        .collect()
}

fn enrich_row(mut row: Value, index: usize, depth: usize) -> Value {
    let Some(object) = row.as_object_mut() else {
        return row;
    };

    let revenue = object.get("revenue").and_then(Value::as_i64).unwrap_or(0);
    let status = object
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("Unknown")
        .to_string();

    object.insert("account_id".to_string(), json!(format!("ACCT-{:04}", index + 1)));
    object.insert("manager".to_string(), json!(MANAGERS[index % MANAGERS.len()]));
    object.insert("region".to_string(), json!(REGIONS[(index + depth) % REGIONS.len()]));
    object.insert(
        "segment".to_string(),
        json!(SEGMENTS[(index + revenue as usize) % SEGMENTS.len()]),
    );
    object.insert("seats".to_string(), json!(((index + 3) * 7) % 120 + 5));
    object.insert(
        "health".to_string(),
        json!(match status {
            ref value if value == "Active" => HEALTH[index % 2],
            ref value if value == "Trial" => "Watch",
            ref value if value == "Churned" => "At Risk",
            ref value if value == "Suspended" => "Watch",
            _ => HEALTH[index % HEALTH.len()],
        }),
    );
    object.insert(
        "last_touch".to_string(),
        json!(format!("2026-{:02}-{:02}", (index % 12) + 1, ((index * 3) % 28) + 1)),
    );
    object.insert(
        "plan".to_string(),
        json!(if revenue >= 1500 { "Growth" } else { "Core" }),
    );

    if let Some(children) = object.get_mut("children").and_then(Value::as_array_mut) {
        let original_children = children.clone();
        *children = original_children
            .into_iter()
            .enumerate()
            .map(|(child_index, child)| enrich_row(child, (index + 1) * 100 + child_index, depth + 1))
            .collect();
    }

    row
}
