use serde::{Deserialize, Serialize};

use crate::models::GridInfiniteScrollState;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaybeRequestInfiniteScrollDataContext {
    pub state: GridInfiniteScrollState,
    pub start_index: usize,
    pub visible_rows: usize,
    pub viewport_rows: usize,
    pub threshold: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InfiniteScrollRequest {
    Top,
    Bottom,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaybeRequestInfiniteScrollDataResult {
    #[serde(default)]
    pub request: Option<InfiniteScrollRequest>,
    pub next_state: GridInfiniteScrollState,
}

pub fn maybe_request_infinite_scroll_data(
    context: &MaybeRequestInfiniteScrollDataContext,
) -> MaybeRequestInfiniteScrollDataResult {
    if context.state.data_loading {
        return MaybeRequestInfiniteScrollDataResult {
            request: None,
            next_state: context.state.clone(),
        };
    }

    if context.state.scroll_up && context.start_index <= context.threshold {
        return MaybeRequestInfiniteScrollDataResult {
            request: Some(InfiniteScrollRequest::Top),
            next_state: GridInfiniteScrollState {
                scroll_up: context.state.scroll_up,
                scroll_down: context.state.scroll_down,
                data_loading: true,
                previous_visible_rows: context.visible_rows,
            },
        };
    }

    if context.state.scroll_down
        && context.start_index + context.viewport_rows
            >= std::cmp::max(context.visible_rows.saturating_sub(context.threshold), 0)
    {
        return MaybeRequestInfiniteScrollDataResult {
            request: Some(InfiniteScrollRequest::Bottom),
            next_state: GridInfiniteScrollState {
                scroll_up: context.state.scroll_up,
                scroll_down: context.state.scroll_down,
                data_loading: true,
                previous_visible_rows: context.visible_rows,
            },
        };
    }

    MaybeRequestInfiniteScrollDataResult {
        request: None,
        next_state: context.state.clone(),
    }
}

pub fn complete_infinite_scroll_data_load(
    state: &GridInfiniteScrollState,
    scroll_up: bool,
    scroll_down: bool,
) -> GridInfiniteScrollState {
    GridInfiniteScrollState {
        scroll_up,
        scroll_down,
        data_loading: false,
        previous_visible_rows: state.previous_visible_rows,
    }
}

pub fn reset_infinite_scroll_state(scroll_up: bool, scroll_down: bool) -> GridInfiniteScrollState {
    GridInfiniteScrollState {
        scroll_up,
        scroll_down,
        data_loading: false,
        previous_visible_rows: 0,
    }
}

pub fn save_infinite_scroll_percentage(
    state: &GridInfiniteScrollState,
    visible_rows: usize,
) -> GridInfiniteScrollState {
    GridInfiniteScrollState {
        scroll_up: state.scroll_up,
        scroll_down: state.scroll_down,
        data_loading: state.data_loading,
        previous_visible_rows: visible_rows,
    }
}

pub fn set_infinite_scroll_directions_state(
    state: &GridInfiniteScrollState,
    scroll_up: bool,
    scroll_down: bool,
) -> GridInfiniteScrollState {
    GridInfiniteScrollState {
        scroll_up,
        scroll_down,
        data_loading: state.data_loading,
        previous_visible_rows: state.previous_visible_rows,
    }
}
