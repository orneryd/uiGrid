use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VirtualWindowRequest {
    pub item_count: usize,
    pub item_size: usize,
    pub viewport_height: usize,
    #[serde(default = "default_overscan")]
    pub overscan: usize,
    #[serde(default)]
    pub scroll_top: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisibleRange {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VirtualWindowResult {
    pub visible_range: VisibleRange,
    pub total_height: usize,
    pub offset_y: usize,
}

const fn default_overscan() -> usize {
    3
}

pub fn calculate_virtual_window(request: &VirtualWindowRequest) -> VirtualWindowResult {
    if request.item_count == 0 || request.item_size == 0 {
        return VirtualWindowResult {
            visible_range: VisibleRange { start: 0, end: 0 },
            total_height: request.item_count.saturating_mul(request.item_size),
            offset_y: 0,
        };
    }

    let raw_start = (request.scroll_top / request.item_size) as isize - request.overscan as isize;
    let start = raw_start.max(0) as usize;
    let viewport_items = request.viewport_height.div_ceil(request.item_size);
    let raw_end =
        raw_start + viewport_items as isize + (request.overscan.saturating_mul(2)) as isize;
    let end = raw_end.max(0) as usize;
    let end = end.min(request.item_count);

    VirtualWindowResult {
        visible_range: VisibleRange { start, end },
        total_height: request.item_count.saturating_mul(request.item_size),
        offset_y: start.saturating_mul(request.item_size),
    }
}

#[cfg(test)]
mod tests {
    use super::{VirtualWindowRequest, VisibleRange, calculate_virtual_window};

    #[test]
    fn calculates_window_with_default_overscan() {
        let result = calculate_virtual_window(&VirtualWindowRequest {
            item_count: 100,
            item_size: 44,
            viewport_height: 220,
            overscan: 3,
            scroll_top: 0,
        });

        assert_eq!(result.visible_range, VisibleRange { start: 0, end: 8 });
        assert_eq!(result.total_height, 4400);
        assert_eq!(result.offset_y, 0);
    }

    #[test]
    fn calculates_window_after_scroll() {
        let result = calculate_virtual_window(&VirtualWindowRequest {
            item_count: 100,
            item_size: 44,
            viewport_height: 220,
            overscan: 3,
            scroll_top: 440,
        });

        assert_eq!(result.visible_range, VisibleRange { start: 7, end: 18 });
        assert_eq!(result.offset_y, 308);
    }

    #[test]
    fn clamps_end_to_item_count() {
        let result = calculate_virtual_window(&VirtualWindowRequest {
            item_count: 5,
            item_size: 44,
            viewport_height: 440,
            overscan: 3,
            scroll_top: 0,
        });

        assert_eq!(result.visible_range, VisibleRange { start: 0, end: 5 });
        assert_eq!(result.total_height, 220);
    }

    #[test]
    fn handles_zero_item_size_safely() {
        let result = calculate_virtual_window(&VirtualWindowRequest {
            item_count: 5,
            item_size: 0,
            viewport_height: 440,
            overscan: 3,
            scroll_top: 100,
        });

        assert_eq!(result.visible_range, VisibleRange { start: 0, end: 0 });
        assert_eq!(result.total_height, 0);
        assert_eq!(result.offset_y, 0);
    }
}
