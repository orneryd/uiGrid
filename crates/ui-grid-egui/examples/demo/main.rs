mod app;
mod columns;
mod data;
mod trading;

fn main() -> eframe::Result<()> {
    let native_options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("ui-grid-core Demo")
            .with_inner_size([1100.0, 700.0])
            .with_min_inner_size([600.0, 400.0]),
        ..Default::default()
    };
    eframe::run_native(
        "grid-demo-egui",
        native_options,
        Box::new(|cc| Ok(Box::new(app::DemoApp::new(cc)))),
    )
}
