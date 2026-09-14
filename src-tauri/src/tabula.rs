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
/// `all` is only the first pages — enough to match a remembered layout.
/// A decade-long PDF is extracted from the stamped/template boxes, not guessed page-by-page.
pub const GUESS_ALL_PAGES: u32 = 8;
const MAX_PAGE: u32 = 10_000;

pub fn parse_page_spec(spec: &str) -> Vec<u32> {
    let trimmed = spec.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("all") {
        return (1..=GUESS_ALL_PAGES).collect();
    }

    let mut pages = Vec::new();
    for part in trimmed.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some((start, end)) = part.split_once('-') {
            if let (Ok(start), Ok(end)) = (start.trim().parse::<u32>(), end.trim().parse::<u32>()) {
                let (lo, hi) = if start <= end {
                    (start, end)
                } else {
                    (end, start)
                };
                let hi = hi.min(MAX_PAGE);
                if lo >= 1 {
                    pages.extend(lo..=hi);
                }
            }
        } else if let Ok(page) = part.parse::<u32>() {
            if page >= 1 && page <= MAX_PAGE {
                pages.push(page);
            }
        }
    }
    pages.sort_unstable();
    pages.dedup();
    pages
}

/// Pages per Tabula process. Large enough for a decade statement without
/// hundreds of JVM starts; small enough to stamp missing JSON page numbers.
pub const PAGES_PER_TABULA_RUN: usize = 200;

#[derive(Debug, Clone, PartialEq)]
pub struct AreaGroup {
    pub pages: Vec<u32>,
    pub method: String,
    pub areas: Vec<TableArea>,
}

/// Compress page numbers into Tabula `-p` form (`1-3,5,8-10`).
pub fn format_page_spec(pages: &[u32]) -> String {
    if pages.is_empty() {
        return "1".into();
    }
    let mut pages = pages.to_vec();
    pages.sort_unstable();
    pages.dedup();

    let mut parts: Vec<String> = Vec::new();
    let mut start = pages[0];
    let mut prev = pages[0];
    for &page in &pages[1..] {
        if page == prev + 1 {
            prev = page;
            continue;
        }
        parts.push(format_range(start, prev));
        start = page;
        prev = page;
    }
    parts.push(format_range(start, prev));
    parts.join(",")
}

fn format_range(start: u32, end: u32) -> String {
    if start == end {
        start.to_string()
    } else {
        format!("{start}-{end}")
    }
}

/// Snap box edges to 16 PDF points so continuation pages with a couple of
/// points of detect jitter still share one Tabula `-a`.
fn round_pt(value: f64) -> i64 {
    (value / 16.0).round() as i64
}

fn area_signature(area: &TableArea) -> (i64, i64, i64, i64) {
    (
        round_pt(area.top),
        round_pt(area.left),
        round_pt(area.bottom),
        round_pt(area.right),
    )
}

fn page_signature(areas: &[&TableArea]) -> Vec<(i64, i64, i64, i64)> {
    let mut signatures: Vec<_> = areas.iter().map(|area| area_signature(area)).collect();
    signatures.sort_unstable();
    signatures
}

fn union_area(into: &mut TableArea, from: &TableArea) {
    into.top = into.top.min(from.top);
    into.left = into.left.min(from.left);
    into.bottom = into.bottom.max(from.bottom);
    into.right = into.right.max(from.right);
}

fn merge_areas(target: &mut [TableArea], incoming: &[&TableArea]) {
    for area in incoming {
        let signature = area_signature(area);
        if let Some(existing) = target
            .iter_mut()
            .find(|candidate| area_signature(candidate) == signature)
        {
            union_area(existing, area);
        }
    }
}

/// Group areas that Tabula can extract together: same method and (nearly) the
/// same box, across many pages. One M-PESA continuation box on pages 2–396
/// becomes one invocation instead of 395 JVM starts.
pub fn group_areas(areas: &[TableArea]) -> Vec<AreaGroup> {
    let mut per_page: Vec<(u32, String, Vec<&TableArea>)> = Vec::new();
    for area in areas {
        if let Some((_, _, list)) = per_page
            .iter_mut()
            .find(|(page, method, _)| *page == area.page && method == &area.method)
        {
            list.push(area);
        } else {
            per_page.push((area.page, area.method.clone(), vec![area]));
        }
    }

    let mut groups: Vec<(Vec<(i64, i64, i64, i64)>, AreaGroup)> = Vec::new();
    for (page, method, list) in per_page {
        let signature = page_signature(&list);
        if let Some((_, group)) = groups
            .iter_mut()
            .find(|(existing, group)| existing == &signature && group.method == method)
        {
            group.pages.push(page);
            merge_areas(&mut group.areas, &list);
        } else {
            groups.push((
                signature,
                AreaGroup {
                    pages: vec![page],
                    method,
                    areas: list.iter().map(|area| (*area).clone()).collect(),
                },
            ));
        }
    }

    groups
        .into_iter()
        .map(|(_, mut group)| {
            group.pages.sort_unstable();
            group.pages.dedup();
            group
        })
        .collect()
}

fn json_page(table: &Value) -> Option<u64> {
    table
        .get("page")
        .and_then(Value::as_u64)
        .or_else(|| table.get("page_number").and_then(Value::as_u64))
        .filter(|page| *page > 0)
}

fn set_page(table: &mut Value, page: u32) {
    if let Some(obj) = table.as_object_mut() {
        obj.insert("page".into(), serde_json::json!(page));
    }
}

/// Tabula 1.0.5 JSON has no `page` field. Stamp it from the `-p` list.
pub fn assign_missing_pages(tables: &mut [Value], pages: &[u32], area_count: usize) {
    if pages.is_empty() {
        return;
    }
    for table in tables.iter_mut() {
        if let Some(page) = json_page(table) {
            set_page(table, page as u32);
        }
    }
    if tables.iter().any(|table| table.get("page").is_some()) {
        return;
    }
    if pages.len() == 1 {
        for table in tables.iter_mut() {
            set_page(table, pages[0]);
        }
        return;
    }
    let areas = area_count.max(1);
    if tables.len() == pages.len() * areas {
        for (index, table) in tables.iter_mut().enumerate() {
            set_page(table, pages[index / areas]);
        }
        return;
    }
    if tables.len() == pages.len() {
        for (table, page) in tables.iter_mut().zip(pages) {
            set_page(table, *page);
        }
        return;
    }
    for (index, table) in tables.iter_mut().enumerate() {
        let page = pages
            .get(index)
            .copied()
            .or_else(|| pages.last().copied())
            .unwrap_or(1);
        set_page(table, page);
    }
}

#[allow(dead_code)]
fn extract_json_array(raw: &str) -> Result<&str, String> {
    let start = raw
        .find('[')
        .ok_or_else(|| format!("Tabula did not return JSON. Output: {}", truncate(raw, 400)))?;
    let end = raw
        .rfind(']')
        .ok_or_else(|| format!("Tabula JSON was truncated. Output: {}", truncate(raw, 400)))?;
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
    let tables: Vec<Value> =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse Tabula JSON: {e}"))?;

    let mut areas = Vec::new();
    for table in tables {
        let top = table.get("top").and_then(Value::as_f64).unwrap_or(0.0);
        let left = table.get("left").and_then(Value::as_f64).unwrap_or(0.0);
        let width = table.get("width").and_then(Value::as_f64).unwrap_or(0.0);
        let height = table.get("height").and_then(Value::as_f64).unwrap_or(0.0);
        let page = table.get("page").and_then(Value::as_u64).unwrap_or(1) as u32;
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
        assert_eq!(groups[0].pages, vec![1]);
        assert_eq!(groups[0].areas.len(), 2);
        assert_eq!(groups[1].pages, vec![2]);
        assert_eq!(groups[1].method, "lattice");
    }

    #[test]
    fn batches_the_same_box_across_pages() {
        let areas: Vec<TableArea> = (2..=5)
            .map(|page| TableArea {
                page,
                top: 80.0,
                left: 40.0,
                bottom: 700.0,
                right: 560.0,
                method: "stream".into(),
            })
            .collect();
        let groups = group_areas(&areas);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].pages, vec![2, 3, 4, 5]);
        assert_eq!(groups[0].areas.len(), 1);
    }

    #[test]
    fn keeps_letterhead_page_separate_from_continuation() {
        let areas = vec![
            TableArea {
                page: 1,
                top: 220.0,
                left: 40.0,
                bottom: 740.0,
                right: 560.0,
                method: "stream".into(),
            },
            TableArea {
                page: 2,
                top: 80.0,
                left: 40.0,
                bottom: 740.0,
                right: 560.0,
                method: "stream".into(),
            },
            TableArea {
                page: 3,
                top: 82.0,
                left: 41.0,
                bottom: 738.0,
                right: 559.0,
                method: "stream".into(),
            },
        ];
        let groups = group_areas(&areas);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].pages, vec![1]);
        assert_eq!(groups[1].pages, vec![2, 3]);
        assert!(groups[1].areas[0].top <= 80.0);
        assert!(groups[1].areas[0].bottom >= 740.0);
    }

    #[test]
    fn formats_page_ranges() {
        assert_eq!(format_page_spec(&[1, 2, 3, 5, 8, 9, 10]), "1-3,5,8-10");
        assert_eq!(format_page_spec(&[4]), "4");
        assert_eq!(format_page_spec(&[]), "1");
    }

    #[test]
    fn stamps_missing_pages_in_area_order() {
        let mut tables = vec![
            serde_json::json!({"data": []}),
            serde_json::json!({"data": []}),
            serde_json::json!({"data": []}),
            serde_json::json!({"data": []}),
        ];
        assign_missing_pages(&mut tables, &[2, 3], 2);
        assert_eq!(tables[0].get("page").and_then(|v| v.as_u64()), Some(2));
        assert_eq!(tables[1].get("page").and_then(|v| v.as_u64()), Some(2));
        assert_eq!(tables[2].get("page").and_then(|v| v.as_u64()), Some(3));
        assert_eq!(tables[3].get("page").and_then(|v| v.as_u64()), Some(3));
    }

    #[test]
    fn leaves_tabula_page_numbers_alone() {
        let mut tables = vec![serde_json::json!({"page": 9, "data": []})];
        assign_missing_pages(&mut tables, &[2], 1);
        assert_eq!(tables[0].get("page").and_then(|v| v.as_u64()), Some(9));
    }

    #[test]
    fn parses_page_spec_ranges_and_lists() {
        assert_eq!(parse_page_spec("all").len(), 8);
        assert_eq!(parse_page_spec("1,3,2"), vec![1, 2, 3]);
        assert_eq!(parse_page_spec("1-3"), vec![1, 2, 3]);
        assert_eq!(parse_page_spec("2-3,5"), vec![2, 3, 5]);
        assert_eq!(parse_page_spec("1-200").len(), 200);
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
