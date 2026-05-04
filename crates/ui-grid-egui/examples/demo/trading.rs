/// High-speed trading terminal simulation.
///
/// Simulates a live order-book / quote feed: each tick randomises price,
/// bid/ask spread, volume, and a directional change flag for every
/// instrument. No external crates — uses a simple LCG for deterministic
/// pseudo-random numbers that is fast enough for 60 Hz updates.
use egui::Color32;
use serde_json::{Value, json};
use ui_grid_core::models::{GridColumnDef, GridColumnType};
use ui_grid_egui::EguiColumnExt;

// ── instruments ──────────────────────────────────────────────────────────────

const INSTRUMENTS: &[(&str, f64, f64)] = &[
    // (symbol, base_price, daily_range)
    ("AAPL", 189.50, 4.0),
    ("MSFT", 415.20, 6.0),
    ("NVDA", 875.00, 25.0),
    ("GOOGL", 175.30, 4.5),
    ("AMZN", 186.40, 5.0),
    ("TSLA", 245.00, 12.0),
    ("META", 510.00, 10.0),
    ("AMD", 162.00, 6.0),
    ("INTC", 31.00, 1.5),
    ("NFLX", 628.00, 14.0),
    ("JPM", 197.00, 4.0),
    ("GS", 461.00, 8.0),
    ("BAC", 37.50, 1.0),
    ("WFC", 58.00, 1.5),
    ("BRK", 410.00, 6.0),
    ("V", 274.00, 5.0),
    ("MA", 471.00, 8.0),
    ("UNH", 510.00, 12.0),
    ("JNJ", 162.00, 3.0),
    ("PFE", 28.00, 0.8),
    ("SPY", 524.00, 8.0),
    ("QQQ", 444.00, 8.0),
    ("IWM", 202.00, 4.0),
    ("GLD", 225.00, 3.0),
    ("BTC-USD", 63_000.0, 2000.0),
    ("ETH-USD", 3_100.0, 150.0),
    ("SOL-USD", 148.0, 10.0),
    ("XRP-USD", 0.52, 0.04),
];

const EXCHANGES: &[&str] = &["NASDAQ", "NYSE", "CBOE", "BATS", "IEX"];
const SECTORS: &[&str] = &[
    "Technology",
    "Technology",
    "Technology",
    "Technology",
    "Consumer",
    "Consumer",
    "Technology",
    "Technology",
    "Technology",
    "Consumer",
    "Finance",
    "Finance",
    "Finance",
    "Finance",
    "Finance",
    "Finance",
    "Finance",
    "Healthcare",
    "Healthcare",
    "Healthcare",
    "ETF",
    "ETF",
    "ETF",
    "Commodity",
    "Crypto",
    "Crypto",
    "Crypto",
    "Crypto",
];

// ── LCG RNG ───────────────────────────────────────────────────────────────────

pub struct Lcg(u64);

impl Lcg {
    pub fn new(seed: u64) -> Self {
        Self(seed ^ 0x9E37_79B9_7F4A_7C15)
    }

    pub fn next(&mut self) -> u64 {
        // Knuth multiplicative + additive constants (64-bit LCG)
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        self.0
    }

    /// f64 in [0, 1)
    pub fn f64(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }

    /// f64 in [lo, hi)
    pub fn range(&mut self, lo: f64, hi: f64) -> f64 {
        lo + self.f64() * (hi - lo)
    }

    /// i64 in [0, n)
    pub fn i64_n(&mut self, n: i64) -> i64 {
        (self.next() % n as u64) as i64
    }
}

// ── live row state ────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct Instrument {
    pub symbol: &'static str,
    pub exchange: &'static str,
    pub sector: &'static str,
    pub price: f64,
    pub base_price: f64,
    pub bid: f64,
    pub ask: f64,
    pub volume: u64,
    pub change: f64,
    pub change_pct: f64,
    pub high: f64,
    pub low: f64,
    pub last_size: u64,
    /// +1 up, -1 down, 0 unchanged
    pub direction: i8,
}

impl Instrument {
    fn new(i: usize, rng: &mut Lcg) -> Self {
        let (symbol, base, daily_range) = INSTRUMENTS[i % INSTRUMENTS.len()];
        let price = base + rng.range(-daily_range * 0.2, daily_range * 0.2);
        let spread = (price * 0.0002).max(0.01);
        Self {
            symbol,
            exchange: EXCHANGES[i % EXCHANGES.len()],
            sector: SECTORS[i % SECTORS.len()],
            price,
            base_price: base,
            bid: price - spread,
            ask: price + spread,
            volume: rng.i64_n(500_000) as u64 + 100_000,
            change: 0.0,
            change_pct: 0.0,
            high: price,
            low: price,
            last_size: rng.i64_n(500) as u64 + 1,
            direction: 0,
        }
    }

    pub fn tick(&mut self, rng: &mut Lcg) {
        // random walk: ±0.15 % per tick with occasional ±0.5 % spikes
        let spike = if rng.f64() < 0.03 { 3.5 } else { 1.0 };
        let pct_move = rng.range(-0.0015, 0.0015) * spike;
        let new_price = (self.price * (1.0 + pct_move))
            .max(self.base_price * 0.5)
            .min(self.base_price * 2.0);

        let spread = (new_price * 0.0002).max(0.01);
        self.direction = if new_price > self.price {
            1
        } else if new_price < self.price {
            -1
        } else {
            0
        };
        self.change = new_price - self.base_price;
        self.change_pct = self.change / self.base_price * 100.0;
        self.price = new_price;
        self.bid = new_price - spread;
        self.ask = new_price + spread;
        self.high = self.high.max(new_price);
        self.low = self.low.min(new_price);
        self.volume += rng.i64_n(5_000) as u64;
        self.last_size = rng.i64_n(800) as u64 + 1;
    }

    pub fn to_json(&self) -> Value {
        json!({
            "id":         self.symbol,
            "symbol":     self.symbol,
            "exchange":   self.exchange,
            "sector":     self.sector,
            "price":      round2(self.price),
            "bid":        round2(self.bid),
            "ask":        round2(self.ask),
            "change":     round2(self.change),
            "change_pct": round2(self.change_pct),
            "high":       round2(self.high),
            "low":        round2(self.low),
            "volume":     self.volume,
            "last_size":  self.last_size,
            "direction":  self.direction,
        })
    }
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

// ── TradingState ──────────────────────────────────────────────────────────────

pub struct TradingState {
    pub instruments: Vec<Instrument>,
    rng: Lcg,
    pub ticks: u64,
    pub running: bool,
    /// rows per tick (1..=all)
    pub updates_per_tick: usize,
    pub fps: f64,
    last_frame_time: f64,
}

impl TradingState {
    pub fn new() -> Self {
        let mut rng = Lcg::new(0xDEAD_BEEF_1234_5678);
        let instruments: Vec<Instrument> = (0..INSTRUMENTS.len())
            .map(|i| Instrument::new(i, &mut rng))
            .collect();
        Self {
            instruments,
            rng,
            ticks: 0,
            running: true,
            updates_per_tick: INSTRUMENTS.len(), // update all by default
            fps: 0.0,
            last_frame_time: 0.0,
        }
    }

    /// Advance one tick: mutate `updates_per_tick` random instruments.
    pub fn tick(&mut self) {
        if !self.running {
            return;
        }
        let n = self.instruments.len();
        let count = self.updates_per_tick.min(n);
        // pick `count` distinct indices via partial Fisher-Yates into a small buffer
        let mut indices: Vec<usize> = (0..n).collect();
        for i in 0..count {
            let j = i + self.rng.i64_n((n - i) as i64) as usize;
            indices.swap(i, j);
        }
        for &idx in &indices[..count] {
            self.instruments[idx].tick(&mut self.rng);
        }
        self.ticks += 1;
    }

    /// Update fps estimate; call once per frame with `egui::Context::input(|i| i.time)`.
    pub fn update_fps(&mut self, now: f64) {
        if self.last_frame_time > 0.0 {
            let dt = now - self.last_frame_time;
            if dt > 0.0 {
                let instant_fps = 1.0 / dt;
                // exponential moving average
                self.fps = self.fps * 0.9 + instant_fps * 0.1;
            }
        }
        self.last_frame_time = now;
    }

    pub fn rows(&self) -> Vec<Value> {
        self.instruments.iter().map(|i| i.to_json()).collect()
    }
}

// ── columns ───────────────────────────────────────────────────────────────────

fn num_col(name: &str, display: &str) -> GridColumnDef {
    GridColumnDef {
        name: name.into(),
        display_name: Some(display.into()),
        field: Some(name.into()),
        r#type: GridColumnType::Number,
        visible: true,
        sortable: true,
        filterable: true,
        enable_sorting: true,
        enable_filtering: true,
        enable_grouping: false,
        enable_pinning: true,
        enable_cell_edit: false,
        ..GridColumnDef::default()
    }
}

fn str_col(name: &str, display: &str) -> GridColumnDef {
    GridColumnDef {
        name: name.into(),
        display_name: Some(display.into()),
        field: Some(name.into()),
        r#type: GridColumnType::String,
        visible: true,
        sortable: true,
        filterable: true,
        enable_sorting: true,
        enable_filtering: true,
        enable_grouping: true,
        enable_pinning: true,
        enable_cell_edit: false,
        ..GridColumnDef::default()
    }
}

pub fn trading_columns() -> Vec<GridColumnDef> {
    vec![
        str_col("symbol", "Symbol"),
        str_col("exchange", "Exch"),
        str_col("sector", "Sector"),
        num_col("price", "Last"),
        num_col("bid", "Bid"),
        num_col("ask", "Ask"),
        num_col("change", "Chg"),
        num_col("change_pct", "Chg %"),
        num_col("high", "High"),
        num_col("low", "Low"),
        num_col("volume", "Volume"),
        num_col("last_size", "Size"),
    ]
}

// ── column extensions (cell renderers) ───────────────────────────────────────

pub fn trading_column_ext() -> Vec<EguiColumnExt> {
    // price cell: flash green/red based on direction field in the same row
    let price_ext = EguiColumnExt::new("price").with_cell_renderer(|ui, ctx| {
        let price = ctx
            .value
            .as_f64()
            .or_else(|| ctx.value.as_i64().map(|v| v as f64))
            .unwrap_or(0.0);
        let dir = ctx.row.entity["direction"].as_i64().unwrap_or(0);
        let (fg, bg) = match dir {
            1 => (Color32::BLACK, Color32::from_rgb(0x22, 0xC5, 0x5E)), // green
            -1 => (Color32::WHITE, Color32::from_rgb(0xEF, 0x44, 0x44)), // red
            _ => (ctx.theme.cell_color, Color32::TRANSPARENT),
        };
        let text = format_price(price);
        let (rect, _) = ui.allocate_exact_size(
            egui::Vec2::new(ui.available_width(), 18.0),
            egui::Sense::hover(),
        );
        if bg != Color32::TRANSPARENT {
            ui.painter().rect_filled(rect, 2.0, bg);
        }
        ui.painter().text(
            egui::Pos2::new(rect.max.x - 4.0, rect.center().y),
            egui::Align2::RIGHT_CENTER,
            text,
            egui::FontId::monospace(12.0),
            fg,
        );
    });

    // change % cell: coloured text
    let chg_pct_ext = EguiColumnExt::new("change_pct").with_cell_renderer(|ui, ctx| {
        let v = ctx
            .value
            .as_f64()
            .or_else(|| ctx.value.as_i64().map(|v| v as f64))
            .unwrap_or(0.0);
        let color = if v > 0.0 {
            Color32::from_rgb(0x22, 0xC5, 0x5E)
        } else if v < 0.0 {
            Color32::from_rgb(0xEF, 0x44, 0x44)
        } else {
            ctx.theme.muted_color
        };
        let sign = if v > 0.0 { "+" } else { "" };
        let (rect, _) = ui.allocate_exact_size(
            egui::Vec2::new(ui.available_width(), 18.0),
            egui::Sense::hover(),
        );
        ui.painter().text(
            egui::Pos2::new(rect.max.x - 4.0, rect.center().y),
            egui::Align2::RIGHT_CENTER,
            format!("{}{:.2}%", sign, v),
            egui::FontId::monospace(12.0),
            color,
        );
    });

    // change cell: coloured
    let chg_ext = EguiColumnExt::new("change").with_cell_renderer(|ui, ctx| {
        let v = ctx
            .value
            .as_f64()
            .or_else(|| ctx.value.as_i64().map(|v| v as f64))
            .unwrap_or(0.0);
        let color = if v > 0.0 {
            Color32::from_rgb(0x22, 0xC5, 0x5E)
        } else if v < 0.0 {
            Color32::from_rgb(0xEF, 0x44, 0x44)
        } else {
            ctx.theme.muted_color
        };
        let sign = if v > 0.0 { "+" } else { "" };
        let (rect, _) = ui.allocate_exact_size(
            egui::Vec2::new(ui.available_width(), 18.0),
            egui::Sense::hover(),
        );
        ui.painter().text(
            egui::Pos2::new(rect.max.x - 4.0, rect.center().y),
            egui::Align2::RIGHT_CENTER,
            format!("{}{}", sign, format_price(v)),
            egui::FontId::monospace(12.0),
            color,
        );
    });

    // volume: comma-formatted
    let vol_ext = EguiColumnExt::new("volume").with_formatter(|value, _row| {
        let v = value
            .as_u64()
            .or_else(|| value.as_i64().map(|v| v as u64))
            .unwrap_or(0);
        format_volume(v)
    });

    // bid/ask: monospace price
    let bid_ext = EguiColumnExt::new("bid").with_formatter(|v, _| {
        format_price(
            v.as_f64()
                .or_else(|| v.as_i64().map(|x| x as f64))
                .unwrap_or(0.0),
        )
    });
    let ask_ext = EguiColumnExt::new("ask").with_formatter(|v, _| {
        format_price(
            v.as_f64()
                .or_else(|| v.as_i64().map(|x| x as f64))
                .unwrap_or(0.0),
        )
    });

    vec![price_ext, chg_ext, chg_pct_ext, vol_ext, bid_ext, ask_ext]
}

fn format_price(p: f64) -> String {
    if p >= 1.0 {
        format!("{:.2}", p)
    } else {
        format!("{:.4}", p)
    }
}

fn format_volume(v: u64) -> String {
    if v >= 1_000_000 {
        format!("{:.2}M", v as f64 / 1_000_000.0)
    } else if v >= 1_000 {
        format!("{:.1}K", v as f64 / 1_000.0)
    } else {
        v.to_string()
    }
}
