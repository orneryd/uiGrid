#![allow(dead_code)]

use egui::Color32;

fn hex(r: u8, g: u8, b: u8) -> Color32 {
    Color32::from_rgb(r, g, b)
}

fn rgba(r: u8, g: u8, b: u8, a: u8) -> Color32 {
    Color32::from_rgba_unmultiplied(r, g, b, a)
}

/// Mirrors the `--ui-grid-*` CSS custom property system from grid.core.styles.scss.
/// Each field corresponds to a CSS variable that the Angular component consumes.
/// Consumers override these to theme the grid, just like setting `--app-ui-grid-*` in CSS.
#[derive(Debug, Clone)]
pub struct GridTheme {
    pub border_color: Color32,
    pub header_background: Color32,
    pub row_odd: Color32,
    pub row_even: Color32,
    pub row_hover: Color32,
    pub cell_color: Color32,
    pub muted_color: Color32,
    pub surface: Color32,
    pub accent: Color32,
    pub group_background: Color32,
    pub radius: f32,
    pub header_weight: f32,

    pub cell_padding_y: f32,
    pub cell_padding_x: f32,
    pub header_padding_y: f32,
    pub header_padding_x: f32,
    pub filter_padding_y: f32,
    pub group_padding_y: f32,
    pub group_indent_per_depth: f32,
    pub tree_indent_per_level: f32,
    pub row_height: f32,
}

impl GridTheme {
    pub fn default_light() -> Self {
        Self {
            border_color: hex(0xd4, 0xd4, 0xd8),
            header_background: hex(0xf3, 0xf4, 0xf6),
            row_odd: hex(0xfc, 0xfc, 0xfd),
            row_even: hex(0xf7, 0xf7, 0xf8),
            row_hover: hex(0xee, 0xf4, 0xff),
            cell_color: hex(0x11, 0x18, 0x27),
            muted_color: hex(0x6b, 0x72, 0x80),
            surface: hex(0xff, 0xff, 0xff),
            accent: hex(0x25, 0x63, 0xeb),
            group_background: hex(0xec, 0xef, 0xf3),
            radius: 4.0,
            header_weight: 700.0,
            cell_padding_y: 12.0,
            cell_padding_x: 16.0,
            header_padding_y: 10.0,
            header_padding_x: 16.0,
            filter_padding_y: 8.0,
            group_padding_y: 10.0,
            group_indent_per_depth: 20.0,
            tree_indent_per_level: 20.0,
            row_height: 44.0,
        }
    }

    pub fn default_dark() -> Self {
        Self {
            border_color: rgba(148, 190, 210, 46),
            header_background: hex(0x11, 0x24, 0x34),
            row_odd: hex(0x0b, 0x18, 0x24),
            row_even: hex(0x0f, 0x22, 0x31),
            row_hover: hex(0x14, 0x32, 0x47),
            cell_color: hex(0xeb, 0xf5, 0xf9),
            muted_color: hex(0x89, 0xa1, 0xb2),
            surface: hex(0x0b, 0x18, 0x24),
            accent: hex(0x67, 0xe8, 0xf9),
            group_background: hex(0x0f, 0x31, 0x40),
            radius: 4.0,
            header_weight: 700.0,
            cell_padding_y: 12.0,
            cell_padding_x: 16.0,
            header_padding_y: 10.0,
            header_padding_x: 16.0,
            filter_padding_y: 8.0,
            group_padding_y: 10.0,
            group_indent_per_depth: 20.0,
            tree_indent_per_level: 20.0,
            row_height: 44.0,
        }
    }

    pub fn wireframe_dark() -> Self {
        Self {
            border_color: rgba(93, 255, 154, 61),
            header_background: hex(0x0a, 0x15, 0x0f),
            row_odd: hex(0x07, 0x10, 0x0b),
            row_even: hex(0x0b, 0x17, 0x10),
            row_hover: hex(0x0f, 0x26, 0x17),
            cell_color: hex(0xc7, 0xff, 0xdc),
            muted_color: hex(0x79, 0xc8, 0x9c),
            surface: hex(0x07, 0x10, 0x0b),
            accent: hex(0x5d, 0xff, 0x9a),
            group_background: hex(0x0d, 0x1e, 0x14),
            radius: 0.0,
            header_weight: 700.0,
            cell_padding_y: 12.0,
            cell_padding_x: 16.0,
            header_padding_y: 10.0,
            header_padding_x: 16.0,
            filter_padding_y: 8.0,
            group_padding_y: 10.0,
            group_indent_per_depth: 20.0,
            tree_indent_per_level: 20.0,
            row_height: 44.0,
        }
    }

    pub fn wireframe_light() -> Self {
        Self {
            border_color: rgba(20, 128, 74, 46),
            header_background: hex(0xed, 0xfd, 0xf1),
            row_odd: hex(0xfb, 0xff, 0xfc),
            row_even: hex(0xf3, 0xff, 0xf6),
            row_hover: hex(0xe5, 0xfb, 0xea),
            cell_color: hex(0x11, 0x37, 0x23),
            muted_color: hex(0x4c, 0x7d, 0x64),
            surface: hex(0xfb, 0xff, 0xfc),
            accent: hex(0x14, 0x80, 0x4a),
            group_background: hex(0xe7, 0xf8, 0xea),
            radius: 0.0,
            header_weight: 700.0,
            cell_padding_y: 12.0,
            cell_padding_x: 16.0,
            header_padding_y: 10.0,
            header_padding_x: 16.0,
            filter_padding_y: 8.0,
            group_padding_y: 10.0,
            group_indent_per_depth: 20.0,
            tree_indent_per_level: 20.0,
            row_height: 44.0,
        }
    }

    pub fn accent_tint(&self, alpha: u8) -> Color32 {
        Color32::from_rgba_unmultiplied(
            self.accent.r(),
            self.accent.g(),
            self.accent.b(),
            alpha,
        )
    }

    pub fn header_sort_active_bg(&self) -> Color32 {
        self.accent_tint(20)
    }

    pub fn expandable_bg(&self) -> Color32 {
        self.accent_tint(10)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GridThemePreset {
    DefaultDark,
    DefaultLight,
    WireframeDark,
    WireframeLight,
}

impl GridThemePreset {
    pub fn build(self) -> GridTheme {
        match self {
            Self::DefaultDark => GridTheme::default_dark(),
            Self::DefaultLight => GridTheme::default_light(),
            Self::WireframeDark => GridTheme::wireframe_dark(),
            Self::WireframeLight => GridTheme::wireframe_light(),
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::DefaultDark => "Dark",
            Self::DefaultLight => "Light",
            Self::WireframeDark => "Wireframe Dark",
            Self::WireframeLight => "Wireframe Light",
        }
    }
}

pub const THEME_PRESETS: &[GridThemePreset] = &[
    GridThemePreset::DefaultDark,
    GridThemePreset::DefaultLight,
    GridThemePreset::WireframeDark,
    GridThemePreset::WireframeLight,
];
