use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableArea {
    pub page: u32,
    pub top: f64,
    pub left: f64,
    pub bottom: f64,
    pub right: f64,
    #[serde(default = "default_method")]
    pub method: String,
}

fn default_method() -> String {
    "stream".to_string()
}

impl TableArea {
    pub fn area_arg(&self) -> String {
        format!("{},{},{},{}", self.top, self.left, self.bottom, self.right)
    }

    #[allow(dead_code)]
    pub fn is_usable(&self) -> bool {
        let width = self.right - self.left;
        let height = self.bottom - self.top;
        width >= 20.0 && height >= 16.0 && self.page >= 1
    }
}

pub fn method_flag(method: &str) -> Option<&'static str> {
    match method.to_ascii_lowercase().as_str() {
        "lattice" => Some("-l"),
        "guess" => Some("-g"),
        "stream" => Some("-t"),
        _ => Some("-t"),
    }
}

/// Parse Tabula `-p` specs (`all`, `1-3`, `1,3,5`, `1-2,5`).
pub fn parse_page_spec(spec: &str) -> Vec<u32> {
    let trimmed = spec.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("all") {
        return (1..=40).collect();
    }

    let mut pages = Vec::new();
    for part in trimmed.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some((start, end)) = part.split_once('-') {
            if let (Ok(start), Ok(end)) = (start.trim().parse::<u32>(), end.trim().parse::<u32>()) {
                let (lo, hi) = if start <= end { (start, end) } else { (end, start) };
                pages.extend(lo..=hi.min(80));
            }
        } else if let Ok(page) = part.parse::<u32>() {
            if page >= 1 {
                pages.push(page);
            }
        }
    }
    pages.sort_unstable();
    pages.dedup();
    pages
}

/// Group areas that share a page and extraction method so Tabula can take
/// multiple `--area` flags in one invocation.
pub fn group_areas(areas: &[TableArea]) -> Vec<(u32, String, Vec<&TableArea>)> {
    let mut groups: Vec<(u32, String, Vec<&TableArea>)> = Vec::new();
    for area in areas {
        if let Some((_, _, list)) = groups.iter_mut().find(|(page, method, _)| {
            *page == area.page && method == &area.method
        }) {
            list.push(area);
        } else {
            groups.push((area.page, area.method.clone(), vec![area]));
        }
    }
    groups
}

#[allow(dead_code)]
fn extract_json_array(raw: &str) -> Result<&str, String> {
    let start = raw.find('[').ok_or_else(|| {
        format!("Tabula did not return JSON. Output: {}", truncate(raw, 400))
    })?;
    let end = raw.rfind(']').ok_or_else(|| {
        format!("Tabula JSON was truncated. Output: {}", truncate(raw, 400))
    })?;
    if end < start {
        return Err("Tabula JSON was malformed".into());
    }
    Ok(&raw[start..=end])
}

#[allow(dead_code)]
fn truncate(value: &str, max: usize) -> String {
    let trimmed = value.trim();
    if trimmed.len() <= max {
        trimmed.to_string()
    } else {
        format!("{}…", &trimmed[..max])
    }
}

/// Parse Tabula `-f JSON` output into selection boxes (guess / extract).
#[allow(dead_code)]
pub fn areas_from_tabula_json(raw: &str) -> Result<Vec<TableArea>, String> {
    let json = extract_json_array(raw)?;
    let tables: Vec<Value> = serde_json::from_str(json)
        .map_err(|e| format!("Failed to parse Tabula JSON: {e}"))?;

    let mut areas = Vec::new();
    for table in tables {
        let top = table.get("top").and_then(Value::as_f64).unwrap_or(0.0);
        let left = table.get("left").and_then(Value::as_f64).unwrap_or(0.0);
        let width = table.get("width").and_then(Value::as_f64).unwrap_or(0.0);
        let height = table.get("height").and_then(Value::as_f64).unwrap_or(0.0);
        let page = table
            .get("page")
            .and_then(Value::as_u64)
            .unwrap_or(1) as u32;
        let method = table
            .get("extraction_method")
            .and_then(Value::as_str)
            .unwrap_or("guess")
            .to_string();

        let area = TableArea {
            page,
            top,
            left,
            bottom: top + height,
            right: left + width,
            method,
        };
        if area.is_usable() {
            areas.push(area);
        }
    }
    Ok(areas)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn area_arg_is_top_left_bottom_right() {
        let area = TableArea {
            page: 1,
            top: 100.5,
            left: 40.0,
            bottom: 700.0,
            right: 560.25,
            method: "stream".into(),
        };
        assert_eq!(area.area_arg(), "100.5,40,700,560.25");
    }

    #[test]
    fn groups_by_page_and_method() {
        let areas = vec![
            TableArea {
                page: 1,
                top: 10.0,
                left: 10.0,
                bottom: 100.0,
                right: 200.0,
                method: "stream".into(),
            },
            TableArea {
                page: 1,
                top: 120.0,
                left: 10.0,
                bottom: 200.0,
                right: 200.0,
                method: "stream".into(),
            },
            TableArea {
                page: 2,
                top: 10.0,
                left: 10.0,
                bottom: 100.0,
                right: 200.0,
                method: "lattice".into(),
            },
        ];
        let groups = group_areas(&areas);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].2.len(), 2);
        assert_eq!(groups[1].0, 2);
        assert_eq!(groups[1].1, "lattice");
    }

    #[test]
    fn parses_page_spec_ranges_and_lists() {
        assert_eq!(parse_page_spec("all").len(), 40);
        assert_eq!(parse_page_spec("1,3,2"), vec![1, 2, 3]);
        assert_eq!(parse_page_spec("1-3"), vec![1, 2, 3]);
        assert_eq!(parse_page_spec("2-3,5"), vec![2, 3, 5]);
    }

    #[test]
    fn parses_guess_json_and_skips_tiny_boxes() {
        let raw = r#"
            warning: ignored
            [
              {
                "extraction_method": "stream",
                "page": 2,
                "top": 80.0,
                "left": 36.0,
                "width": 520.0,
                "height": 640.0
              },
              {
                "extraction_method": "stream",
                "page": 2,
                "top": 0.0,
                "left": 0.0,
                "width": 5.0,
                "height": 5.0
              }
            ]
        "#;
        let areas = areas_from_tabula_json(raw).unwrap();
        assert_eq!(areas.len(), 1);
        assert_eq!(areas[0].page, 2);
        assert_eq!(areas[0].bottom, 720.0);
        assert_eq!(areas[0].right, 556.0);
        assert_eq!(areas[0].method, "stream");
    }
}
