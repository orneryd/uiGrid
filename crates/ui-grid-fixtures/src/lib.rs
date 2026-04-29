use serde_json::{Value, json};

pub const FIXTURE_VERSION: &str = "0.1.0";

pub fn sample_rows() -> Vec<Value> {
	vec![
		json!({
			"id": "row-1",
			"owner": "Alice",
			"status": "Active",
			"revenue": 1200,
			"enabled": true,
			"renewal": "2026-01-15",
			"tier": "Enterprise"
		}),
		json!({
			"id": "row-2",
			"owner": "Bob",
			"status": "Trial",
			"revenue": 450,
			"enabled": false,
			"renewal": "2026-03-03",
			"tier": "Starter"
		}),
		json!({
			"id": "row-3",
			"owner": "Alicia",
			"status": "Active",
			"revenue": 2100,
			"enabled": true,
			"renewal": "2025-12-20",
			"tier": "Enterprise"
		}),
		json!({
			"id": "row-4",
			"owner": "Charlie",
			"status": "Churned",
			"revenue": 75,
			"enabled": false,
			"renewal": "2024-08-01",
			"tier": "Legacy"
		})
	]
}

pub fn sample_tree_rows() -> Vec<Value> {
	vec![
		json!({
			"id": "acct-1",
			"owner": "North America",
			"status": "Region",
			"revenue": 0,
			"children": [
				{
					"id": "acct-1-1",
					"owner": "Alice",
					"status": "Active",
					"revenue": 1200,
					"children": []
				},
				{
					"id": "acct-1-2",
					"owner": "Alicia",
					"status": "Trial",
					"revenue": 800,
					"children": []
				}
			]
		}),
		json!({
			"id": "acct-2",
			"owner": "Europe",
			"status": "Region",
			"revenue": 0,
			"children": [
				{
					"id": "acct-2-1",
					"owner": "Bob",
					"status": "Active",
					"revenue": 640,
					"children": []
				}
			]
		})
	]
}
