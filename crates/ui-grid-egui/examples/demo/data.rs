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
            Dataset::Flat => ui_grid_fixtures::sample_rows(),
            Dataset::Tree => ui_grid_fixtures::sample_tree_rows(),
            Dataset::Large => generate_large_dataset(60),
            Dataset::Huge => generate_large_dataset(100_000),
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
    "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank",
    "Ivy", "Jack", "Karen", "Leo", "Mona", "Nick", "Olivia", "Pat",
];
const STATUSES: &[&str] = &["Active", "Trial", "Churned", "Suspended"];
const TIERS: &[&str] = &["Enterprise", "Starter", "Legacy", "Pro"];

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
